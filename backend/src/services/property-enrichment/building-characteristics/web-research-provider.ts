/**
 * Building Characteristics Web Research Provider (Stream 3)
 *
 * Researches building characteristics that county GIS systems never provide:
 * - constructionType, buildingType, parkingType, parkingRatio, amenities, stories
 *
 * Uses web search (kimi_search_v2) + page fetch (kimi_fetch_v2) to find property
 * details from apartment listing sites, property websites, and review platforms.
 *
 * Confidence scoring distinguishes primary sources (apartments.com, property
 * websites) from secondary sources (reviews, news) and inferred data.
 */

// ============================================================================
// BUILT-IN TOOL DECLARATIONS
// ============================================================================
// These tools are provided by the Daimon/Kimi execution environment.
// They are injected at runtime; no npm package is required.

declare function kimi_search_v2(params: {
  query: string;
  limit?: number;
  include_content?: boolean;
}): Promise<{
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source?: string;
    date?: string;
  }>;
}>;

declare function kimi_fetch_v2(params: { url: string }): Promise<string>;

// ============================================================================
// TYPES
// ============================================================================

export interface BuildingCharacteristicsResearchResult {
  yearBuilt?: number | null;
  stories?: number | null;
  constructionType?: string | null; // 'wood_frame' | 'concrete' | 'steel' | 'masonry' | 'metal_building'
  buildingType?: string | null; // 'garden' | 'midrise' | 'highrise' | 'townhouse' | 'wrap' | 'mixed_use'
  parkingType?: string | null; // 'surface' | 'garage' | 'covered' | 'none'
  parkingRatio?: number | null;
  amenities?: string[];

  // Provenance
  source: 'web_research';
  confidence: number; // 0.0-1.0 aggregate
  fieldConfidences: Record<string, number>; // per-field confidence
  searchQueries: string[]; // what was searched
  sources: string[]; // URLs that contributed
  skippedFields?: string[]; // fields skipped because known data was provided
}

export interface WebProviderOptions {
  propertyName?: string;
  zip?: string;
  knownYearBuilt?: number; // from county GIS — don't re-research if confident
  knownStories?: number; // from OM or other source
  knownUnits?: number; // from county GIS or OM
}

// ============================================================================
// RATE LIMITER
// ============================================================================

/**
 * Simple in-memory rate limiter for web searches.
 * Enforces max N requests per minute and max M requests per day.
 */
class WebResearchRateLimiter {
  private requestLog: number[] = [];
  private dailyCount = 0;
  private dailyResetAt = 0;

  constructor(
    private readonly requestsPerMinute: number,
    private readonly requestsPerDay: number
  ) {}

  async acquireSlot(): Promise<boolean> {
    const now = Date.now();

    // Daily cap (rolling 24 h window)
    if (now > this.dailyResetAt) {
      this.dailyResetAt = now + 24 * 60 * 60 * 1000;
      this.dailyCount = 0;
    }
    if (this.dailyCount >= this.requestsPerDay) {
      const waitMs = Math.max(1000, this.dailyResetAt - now);
      console.warn(
        `[WebResearchProvider] Daily rate limit (${this.requestsPerDay}) reached — queuing for ${Math.ceil(waitMs / 60000)} min`
      );
      await new Promise((r) => setTimeout(r, waitMs));
      this.dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;
      this.dailyCount = 0;
    }

    // Per-minute cap
    const windowStart = now - 60_000;
    this.requestLog = this.requestLog.filter((t) => t > windowStart);
    if (this.requestLog.length >= this.requestsPerMinute) {
      const oldest = this.requestLog[0];
      const waitMs = Math.max(0, oldest + 60_000 - now) + 50;
      console.warn(
        `[WebResearchProvider] Per-minute rate limit (${this.requestsPerMinute}) reached — waiting ${Math.ceil(waitMs / 1000)} s`
      );
      await new Promise((r) => setTimeout(r, waitMs));
      this.requestLog = this.requestLog.filter((t) => t > Date.now() - 60_000);
    }

    this.requestLog.push(Date.now());
    this.dailyCount++;
    return true;
  }
}

// ============================================================================
// SOURCE CLASSIFIER
// ============================================================================

/** Classify a URL as primary or secondary source for confidence scoring. */
function classifySource(url: string): 'primary' | 'secondary' {
  const primaryDomains = [
    'apartments.com',
    'rentcafe.com',
    'apartmentfinder.com',
    'apartmentguide.com',
    'rent.com',
    'zillow.com',
    'loopnet.com',
    'costar.com',
    'crexi.com',
    'mymultifamily.com',
  ];
  const lower = url.toLowerCase();
  if (primaryDomains.some((d) => lower.includes(d))) return 'primary';
  return 'secondary';
}

function confidenceForSource(sourceType: 'primary' | 'secondary', inferred = false): number {
  if (inferred) return 0.5;
  return sourceType === 'primary' ? 0.85 : 0.6;
}

// ============================================================================
// DATA EXTRACTORS
// ============================================================================

interface ExtractedField<T> {
  value: T;
  confidence: number;
  source: string;
}

/** Extract stories from text snippets. */
function extractStories(text: string, sourceUrl: string): ExtractedField<number> | null {
  const sourceType = classifySource(sourceUrl);
  const patterns = [
    /(\d+)\s*(?:-story|story\b|stories\b)/i,
    /(\d+)\s*(?:-floor|floor\b|floors\b)/i,
    /(\d+)\s*(?:-level|level\b|levels\b)/i,
    /(?:building|property)\s+has\s+(\d+)\s*(?:floors?|stories?|levels?)/i,
    /number of stories[:\s]+(\d+)\s*(?:-\s*\d+)?/i,
    /floors[:\s]+(\d+)\s*(?:-\s*\d+)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > 0 && val < 200) {
        return { value: val, confidence: confidenceForSource(sourceType), source: sourceUrl };
      }
    }
  }
  return null;
}

/** Extract construction type from text. */
function extractConstructionType(text: string, sourceUrl: string): ExtractedField<string> | null {
  const sourceType = classifySource(sourceUrl);
  const mappings: Array<{ type: string; patterns: RegExp[] }> = [
    {
      type: 'wood_frame',
      patterns: [
        /wood[\s-]frame/i,
        /wood frame/i,
        /stick[\s-]built/i,
        /stick built/i,
        /wood construction/i,
        /frame construction/i,
      ],
    },
    {
      type: 'concrete',
      patterns: [
        /concrete/i,
        /cast[\s-]in[\s-]place/i,
        /poured concrete/i,
        /concrete construction/i,
      ],
    },
    {
      type: 'steel',
      patterns: [/steel[\s-]frame/i, /steel frame/i, /steel construction/i, /steel building/i],
    },
    {
      type: 'masonry',
      patterns: [/masonry/i, /brick construction/i, /brick exterior/i, /block construction/i, /cinder block/i],
    },
    {
      type: 'metal_building',
      patterns: [/metal building/i, /pre[\s-]engineered metal/i, /metal construction/i],
    },
  ];

  for (const mapping of mappings) {
    for (const pattern of mapping.patterns) {
      if (pattern.test(text)) {
        return {
          value: mapping.type,
          confidence: confidenceForSource(sourceType),
          source: sourceUrl,
        };
      }
    }
  }
  return null;
}

/** Extract explicit building type mentions, or infer from stories. */
function extractBuildingType(
  text: string,
  sourceUrl: string,
  inferredStories?: number
): ExtractedField<string> | null {
  const sourceType = classifySource(sourceUrl);

  // Explicit mentions
  const explicitPatterns: Array<{ type: string; pattern: RegExp }> = [
    { type: 'garden', pattern: /garden[\s-]style/i },
    { type: 'garden', pattern: /garden apartments/i },
    { type: 'midrise', pattern: /mid[\s-]?rise/i },
    { type: 'highrise', pattern: /high[\s-]rise/i },
    { type: 'townhouse', pattern: /townhome/i },
    { type: 'townhouse', pattern: /townhouse/i },
    { type: 'wrap', pattern: /wrap[\s-]style/i },
    { type: 'mixed_use', pattern: /mixed[\s-]use/i },
  ];

  for (const { type, pattern } of explicitPatterns) {
    if (pattern.test(text)) {
      return { value: type, confidence: confidenceForSource(sourceType), source: sourceUrl };
    }
  }

  // Infer from stories
  if (inferredStories !== undefined) {
    let inferred: string | null = null;
    if (inferredStories <= 3) inferred = 'garden';
    else if (inferredStories <= 6) inferred = 'midrise';
    else inferred = 'highrise';

    if (inferred) {
      return {
        value: inferred,
        confidence: confidenceForSource(sourceType, true),
        source: sourceUrl,
      };
    }
  }

  return null;
}

/** Extract parking type from text. */
function extractParkingType(text: string, sourceUrl: string): ExtractedField<string> | null {
  const sourceType = classifySource(sourceUrl);
  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type: 'surface', regex: /surface parking/i },
    { type: 'surface', regex: /surface lot/i },
    { type: 'garage', regex: /garage parking/i },
    { type: 'garage', regex: /parking garage/i },
    { type: 'garage', regex: /attached garage/i },
    { type: 'garage', regex: /detached garage/i },
    { type: 'garage', regex: /underground parking/i },
    { type: 'covered', regex: /covered parking/i },
    { type: 'covered', regex: /carport/i },
    { type: 'none', regex: /no parking/i },
    { type: 'none', regex: /street parking only/i },
  ];

  for (const { type, regex } of patterns) {
    if (regex.test(text)) {
      return { value: type, confidence: confidenceForSource(sourceType), source: sourceUrl };
    }
  }
  return null;
}

/** Extract parking ratio from text. */
function extractParkingRatio(text: string, sourceUrl: string): ExtractedField<number> | null {
  const sourceType = classifySource(sourceUrl);
  const patterns = [
    /(\d+(?:\.\d+)?)\s*spaces?\s*per\s*(?:unit|apt|apartment)/i,
    /parking ratio\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*:\s*1/i,
    /(\d+(?:\.\d+)?)\s*:\s*1\s*parking/i,
    /(\d+(?:\.\d+)?)\s*:\s*1\s*ratio/i,
    /(\d+(?:\.\d+)?)\s*parking spaces?\s*per\s*unit/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val >= 0 && val <= 20) {
        return { value: val, confidence: confidenceForSource(sourceType), source: sourceUrl };
      }
    }
  }
  return null;
}

/** Extract amenities from text. */
function extractAmenities(text: string, _sourceUrl: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  const amenityPatterns: Array<{ name: string; patterns: RegExp[] }> = [
    {
      name: 'pool',
      patterns: [/\bpool\b/i, /\bswimming pool\b/i, /\bresort-style pool\b/i],
    },
    {
      name: 'fitness_center',
      patterns: [/\bfitness center\b/i, /\bgym\b/i, /\bexercise room\b/i, /\bworkout\b/i, /\bfitness studio\b/i],
    },
    {
      name: 'clubhouse',
      patterns: [/\bclubhouse\b/i, /\bcommunity room\b/i, /\bresident lounge\b/i],
    },
    {
      name: 'concierge',
      patterns: [/\bconcierge\b/i, /\bdoorman\b/i, /\bfront desk\b/i, /\b24[\s/-]hour desk\b/i],
    },
    {
      name: 'dog_park',
      patterns: [/\bdog park\b/i, /\bpet park\b/i, /\bdog run\b/i, /\bbark park\b/i],
    },
    {
      name: 'rooftop_deck',
      patterns: [/\brooftop\b/i, /\broof deck\b/i, /\bsky lounge\b/i, /\brooftop terrace\b/i],
    },
    {
      name: 'bbq_area',
      patterns: [/\bbbq\b/i, /\bgrill area\b/i, /\bgrilling station\b/i, /\boutdoor kitchen\b/i],
    },
    {
      name: 'business_center',
      patterns: [/\bbusiness center\b/i, /\bcyber lounge\b/i, /\bco-working space\b/i],
    },
    {
      name: 'package_lockers',
      patterns: [/\bpackage locker\b/i, /\bpackage room\b/i, /\bamazon hub\b/i],
    },
    {
      name: 'playground',
      patterns: [/\bplayground\b/i, /\bplay area\b/i],
    },
    {
      name: 'tennis_court',
      patterns: [/\btennis court\b/i, /\btennis\b/i],
    },
    {
      name: 'basketball_court',
      patterns: [/\bbasketball court\b/i, /\bsports court\b/i],
    },
    {
      name: 'valet_trash',
      patterns: [/\bvalet trash\b/i, /\btrash valet\b/i, /\bdoorstep trash\b/i],
    },
    {
      name: 'garage_parking',
      patterns: [/\bgarage parking\b/i, /\bcovered parking\b/i, /\bassigned parking\b/i],
    },
    {
      name: 'elevator',
      patterns: [/\belevator\b/i, /\belevators\b/i],
    },
    {
      name: 'washer_dryer',
      patterns: [
        /\bin-unit washer\b/i,
        /\bin-unit laundry\b/i,
        /\bwasher[\s/]dryer\b/i,
        /\bfull-size washer\b/i,
      ],
    },
    {
      name: 'balcony',
      patterns: [/\bbalcon\b/i, /\bprivate balcony\b/i, /\b patio\b/i, /\bterrace\b/i],
    },
    {
      name: 'fireplace',
      patterns: [/\bfireplace\b/i, /\bfireplaces\b/i],
    },
    {
      name: 'walk_in_closets',
      patterns: [/\bwalk-in closet\b/i, /\bwalk in closet\b/i, /\blarge closet\b/i],
    },
    {
      name: 'hardwood_floors',
      patterns: [/\bhardwood floor\b/i, /\bhardwood\b/i, /\bwood floor\b/i],
    },
    {
      name: 'granite_counters',
      patterns: [/\bgranite counter\b/i, /\bgranite\b/i, /\bquartz counter\b/i],
    },
    {
      name: 'stainless_steel_appliances',
      patterns: [/\bstainless steel\b/i, /\bss appliances\b/i, /\benergy star\b/i],
    },
  ];

  for (const amenity of amenityPatterns) {
    for (const pattern of amenity.patterns) {
      if (pattern.test(text)) {
        found.add(amenity.name);
        break;
      }
    }
  }

  return Array.from(found);
}

/** Extract year built from text (only used when knownYearBuilt is not provided). */
function extractYearBuilt(text: string, sourceUrl: string): ExtractedField<number> | null {
  const sourceType = classifySource(sourceUrl);
  const patterns = [
    /built in\s+(\d{4})/i,
    /constructed in\s+(\d{4})/i,
    /year built[\s:]+(\d{4})/i,
    /built[\s:]+(\d{4})/i,
    /\(\s*(\d{4})\s*\)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1], 10);
      const currentYear = new Date().getFullYear();
      if (year >= 1800 && year <= currentYear + 5) {
        return { value: year, confidence: confidenceForSource(sourceType), source: sourceUrl };
      }
    }
  }
  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Derive a likely property name from a street address. */
function derivePropertyName(address: string): string {
  // Extract number + street name (e.g. "464 Bishop" from "464 Bishop Street NW")
  const match = address.match(/^(\d+)\s+([^,]+)/);
  if (match) {
    const number = match[1];
    const streetPart = match[2].trim();
    // Remove common suffixes like Street, Ave, Road, etc.
    const cleaned = streetPart
      .replace(/\s+(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|court|ct|circle|cir|place|pl|parkway|pkwy|highway|hwy|trail|way)\b/gi, '')
      .replace(/\s+(north|south|east|west|northeast|northwest|southeast|southwest|n|s|e|w|ne|nw|se|sw)\b/gi, '')
      .trim();
    return `${number} ${cleaned}`.trim();
  }
  return address.split(',')[0].trim();
}

/** Merge multiple extracted fields, keeping the highest-confidence value. */
function mergeExtractions<T>(extractions: Array<ExtractedField<T> | null>): { value: T; confidence: number; source: string } | null {
  let best: { value: T; confidence: number; source: string } | null = null;
  for (const ex of extractions) {
    if (!ex) continue;
    if (!best || ex.confidence > best.confidence) {
      best = { value: ex.value, confidence: ex.confidence, source: ex.source };
    }
  }
  return best;
}

/** Normalize a raw text blob for extraction (strip excessive whitespace). */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// PROVIDER
// ============================================================================

/**
 * Web research provider for building characteristics enrichment.
 *
 * Searches the public web for property details (stories, construction type,
 * parking, amenities) that are not available from county GIS systems.
 */
export class BuildingCharacteristicsWebProvider {
  private rateLimiter = new WebResearchRateLimiter(3, 30);

  /**
   * Research building characteristics for a property.
   *
   * @param address  Street address (e.g. "464 Bishop Street Northwest")
   * @param city     City name
   * @param state    State name or abbreviation
   * @param options  Optional property name, zip, and known data to skip re-researching
   * @returns Structured research result with confidence scores
   */
  async research(
    address: string,
    city: string,
    state: string,
    options?: WebProviderOptions
  ): Promise<BuildingCharacteristicsResearchResult> {
    const queries: string[] = [];
    const allSources: string[] = [];
    const fieldConfidences: Record<string, number> = {};
    const skippedFields: string[] = [];

    // Determine effective property name
    const propertyName = options?.propertyName?.trim() || derivePropertyName(address);
    const stateAbbrev = state.length === 2 ? state.toUpperCase() : state;

    try {
      // ----------------------------------------------------------------------
      // Build search queries
      // ----------------------------------------------------------------------
      queries.push(`${propertyName} ${city} ${stateAbbrev} apartments amenities parking stories`);
      queries.push(`${address} ${city} building type construction parking amenities`);
      queries.push(`${propertyName} ${city} floor plans amenities pool fitness`);

      console.log(`[WebResearchProvider] Researching "${propertyName}" in ${city}, ${stateAbbrev}`);
      console.log(`[WebResearchProvider] Queries:`, queries);

      // ----------------------------------------------------------------------
      // Execute searches (with rate limiting)
      // ----------------------------------------------------------------------
      const searchResults: Array<{
        title: string;
        url: string;
        snippet: string;
      }> = [];

      for (const query of queries) {
        await this.rateLimiter.acquireSlot();
        console.log(`[WebResearchProvider] Searching: ${query}`);
        const result = await kimi_search_v2({ query, limit: 5, include_content: false });
        if (result?.results) {
          for (const r of result.results) {
            searchResults.push({ title: r.title, url: r.url, snippet: r.snippet });
            if (!allSources.includes(r.url)) allSources.push(r.url);
          }
        }
      }

      console.log(`[WebResearchProvider] Got ${searchResults.length} search results from ${allSources.length} unique sources`);

      // ----------------------------------------------------------------------
      // Fetch top primary-source pages for richer extraction
      // ----------------------------------------------------------------------
      const pagesToFetch = allSources
        .filter((url) => classifySource(url) === 'primary')
        .slice(0, 3);

      const fetchedTexts: Array<{ url: string; text: string }> = [];
      for (const url of pagesToFetch) {
        await this.rateLimiter.acquireSlot();
        try {
          console.log(`[WebResearchProvider] Fetching: ${url}`);
          const text = await kimi_fetch_v2({ url });
          if (text && text.length > 50) {
            fetchedTexts.push({ url, text: normalizeText(text) });
          }
        } catch (fetchErr) {
          console.warn(`[WebResearchProvider] Fetch failed for ${url}:`, fetchErr);
        }
      }

      // ----------------------------------------------------------------------
      // Prepare extraction corpus: snippets + fetched page text
      // ----------------------------------------------------------------------
      const corpus: Array<{ text: string; url: string }> = [
        ...searchResults.map((r) => ({ text: normalizeText(r.snippet), url: r.url })),
        ...fetchedTexts.map((r) => ({ text: r.text, url: r.url })),
      ];

      // ----------------------------------------------------------------------
      // Extract fields
      // ----------------------------------------------------------------------

      // --- stories ---
      let stories: number | null = null;
      if (options?.knownStories !== undefined && options.knownStories > 0) {
        stories = options.knownStories;
        fieldConfidences.stories = 1.0;
        skippedFields.push('stories');
        console.log(`[WebResearchProvider] Using knownStories: ${stories}`);
      } else {
        const storiesExtractions = corpus.map((c) => extractStories(c.text, c.url));
        const storiesBest = mergeExtractions(storiesExtractions);
        if (storiesBest) {
          stories = storiesBest.value;
          fieldConfidences.stories = storiesBest.confidence;
          console.log(`[WebResearchProvider] Extracted stories: ${stories} (confidence: ${storiesBest.confidence})`);
        } else {
          fieldConfidences.stories = 0.0;
        }
      }

      // --- yearBuilt ---
      let yearBuilt: number | null = null;
      if (options?.knownYearBuilt !== undefined && options.knownYearBuilt > 1800) {
        yearBuilt = options.knownYearBuilt;
        fieldConfidences.yearBuilt = 1.0;
        skippedFields.push('yearBuilt');
        console.log(`[WebResearchProvider] Using knownYearBuilt: ${yearBuilt}`);
      } else {
        const yearBuiltExtractions = corpus.map((c) => extractYearBuilt(c.text, c.url));
        const yearBuiltBest = mergeExtractions(yearBuiltExtractions);
        if (yearBuiltBest) {
          yearBuilt = yearBuiltBest.value;
          fieldConfidences.yearBuilt = yearBuiltBest.confidence;
          console.log(`[WebResearchProvider] Extracted yearBuilt: ${yearBuilt} (confidence: ${yearBuiltBest.confidence})`);
        } else {
          fieldConfidences.yearBuilt = 0.0;
        }
      }

      // --- constructionType ---
      const constructionTypeExtractions = corpus.map((c) => extractConstructionType(c.text, c.url));
      const constructionTypeBest = mergeExtractions(constructionTypeExtractions);
      const constructionType = constructionTypeBest?.value ?? null;
      fieldConfidences.constructionType = constructionTypeBest?.confidence ?? 0.0;
      if (constructionType) {
        console.log(`[WebResearchProvider] Extracted constructionType: ${constructionType} (confidence: ${constructionTypeBest!.confidence})`);
      }

      // --- buildingType ---
      const buildingTypeExtractions = corpus.map((c) =>
        extractBuildingType(c.text, c.url, stories ?? undefined)
      );
      const buildingTypeBest = mergeExtractions(buildingTypeExtractions);
      const buildingType = buildingTypeBest?.value ?? null;
      fieldConfidences.buildingType = buildingTypeBest?.confidence ?? 0.0;
      if (buildingType) {
        console.log(`[WebResearchProvider] Extracted buildingType: ${buildingType} (confidence: ${buildingTypeBest!.confidence})`);
      }

      // --- parkingType ---
      const parkingTypeExtractions = corpus.map((c) => extractParkingType(c.text, c.url));
      const parkingTypeBest = mergeExtractions(parkingTypeExtractions);
      const parkingType = parkingTypeBest?.value ?? null;
      fieldConfidences.parkingType = parkingTypeBest?.confidence ?? 0.0;
      if (parkingType) {
        console.log(`[WebResearchProvider] Extracted parkingType: ${parkingType} (confidence: ${parkingTypeBest!.confidence})`);
      }

      // --- parkingRatio ---
      const parkingRatioExtractions = corpus.map((c) => extractParkingRatio(c.text, c.url));
      const parkingRatioBest = mergeExtractions(parkingRatioExtractions);
      const parkingRatio = parkingRatioBest?.value ?? null;
      fieldConfidences.parkingRatio = parkingRatioBest?.confidence ?? 0.0;
      if (parkingRatio) {
        console.log(`[WebResearchProvider] Extracted parkingRatio: ${parkingRatio} (confidence: ${parkingRatioBest!.confidence})`);
      }

      // --- amenities (accumulate from all sources, deduplicate) ---
      const allAmenities = new Set<string>();
      for (const c of corpus) {
        const amens = extractAmenities(c.text, c.url);
        for (const a of amens) allAmenities.add(a);
      }
      const amenities = Array.from(allAmenities).sort();
      fieldConfidences.amenities = amenities.length > 0 ? 0.6 : 0.0;
      if (amenities.length > 0) {
        console.log(`[WebResearchProvider] Extracted amenities: ${amenities.join(', ')}`);
      }

      // ----------------------------------------------------------------------
      // Compute aggregate confidence (average of all field confidences)
      // ----------------------------------------------------------------------
      const confidenceValues = Object.values(fieldConfidences);
      const aggregateConfidence =
        confidenceValues.length > 0
          ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
          : 0.0;

      console.log(`[WebResearchProvider] Aggregate confidence: ${aggregateConfidence.toFixed(2)}`);

      return {
        yearBuilt,
        stories,
        constructionType,
        buildingType,
        parkingType,
        parkingRatio,
        amenities,
        source: 'web_research',
        confidence: parseFloat(aggregateConfidence.toFixed(2)),
        fieldConfidences,
        searchQueries: queries,
        sources: allSources,
        skippedFields: skippedFields.length > 0 ? skippedFields : undefined,
      };
    } catch (error) {
      console.error(`[WebResearchProvider] Fatal error during research:`, error);
      // Return empty result on any error — never throw
      return {
        yearBuilt: options?.knownYearBuilt ?? null,
        stories: options?.knownStories ?? null,
        constructionType: null,
        buildingType: null,
        parkingType: null,
        parkingRatio: null,
        amenities: [],
        source: 'web_research',
        confidence: 0.0,
        fieldConfidences: {},
        searchQueries: queries,
        sources: allSources,
        skippedFields: skippedFields.length > 0 ? skippedFields : undefined,
      };
    }
  }
}
