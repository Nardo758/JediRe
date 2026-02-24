/**
 * Cloudflare Worker: Municode Zoning Scraper
 * 
 * Scrapes zoning district information from Municode library
 * 
 * Endpoints:
 *   POST /scrape
 *   Body: { municipalityId, name, state, municodeUrl, zoningChapterPath }
 * 
 * Deploy:
 *   wrangler deploy
 */

// List of municipalities with Municode URLs
const MUNICIPALITIES = {
  'birmingham-al': {
    name: 'Birmingham',
    state: 'AL',
    municodeUrl: 'https://library.municode.com/al/birmingham/codes/code_of_ordinances',
    zoningChapterPath: '?nodeId=COOR_TITZOZORE',
  },
  'montgomery-al': {
    name: 'Montgomery',
    state: 'AL',
    municodeUrl: 'https://library.municode.com/al/montgomery/codes/code_of_ordinances',
    zoningChapterPath: '?nodeId=PTIICOOR_CH13ZO',
  },
  'louisville-ky': {
    name: 'Louisville',
    state: 'KY',
    municodeUrl: 'https://library.municode.com/ky/louisville/codes/code_of_ordinances',
    zoningChapterPath: '?nodeId=CD_ORD_CH4LADECO',
  },
  'lexington-ky': {
    name: 'Lexington',
    state: 'KY',
    municodeUrl: 'https://library.municode.com/ky/lexington-fayette_county/codes/code_of_ordinances',
    zoningChapterPath: '?nodeId=COOR_ARTIZOOR',
  },
  'fort-worth-tx': {
    name: 'Fort Worth',
    state: 'TX',
    municodeUrl: 'https://library.municode.com/tx/fort_worth/codes/code_of_ordinances',
    zoningChapterPath: '?nodeId=COOR_CH14ZO',
  },
  'el-paso-tx': {
    name: 'El Paso',
    state: 'TX',
    municodeUrl: 'https://library.municode.com/tx/el_paso/codes/code_of_ordinances',
    zoningChapterPath: '?nodeId=TIT20ZO',
  },
  // Add remaining 20 cities...
};

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // GET /list - List available municipalities
    if (request.method === 'GET' && url.pathname === '/list') {
      return new Response(JSON.stringify({
        municipalities: Object.keys(MUNICIPALITIES),
        count: Object.keys(MUNICIPALITIES).length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /scrape - Scrape a municipality
    if (request.method === 'POST' && url.pathname === '/scrape') {
      try {
        const body = await request.json();
        const { municipalityId } = body;

        if (!municipalityId) {
          return new Response(JSON.stringify({ error: 'Missing municipalityId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const municipality = MUNICIPALITIES[municipalityId];
        if (!municipality) {
          return new Response(JSON.stringify({ error: 'Municipality not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch Municode page
        const municodeUrl = `${municipality.municodeUrl}${municipality.zoningChapterPath}`;
        console.log(`Fetching: ${municodeUrl}`);

        const response = await fetch(municodeUrl, {
          headers: {
            'User-Agent': 'JEDI-RE-Zoning-Research/1.0 (Educational Purpose)',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch Municode: ${response.status}`);
        }

        const html = await response.text();

        // Parse zoning districts from HTML
        const districts = parseZoningDistricts(html, municipalityId, municipality);

        return new Response(JSON.stringify({
          success: true,
          municipality: municipality.name,
          state: municipality.state,
          districtsFound: districts.length,
          districts,
          scrapedAt: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // POST /scrape-all - Queue all municipalities
    if (request.method === 'POST' && url.pathname === '/scrape-all') {
      // Return list of cities to scrape
      // Your backend can then call /scrape for each one
      return new Response(JSON.stringify({
        municipalities: Object.entries(MUNICIPALITIES).map(([id, muni]) => ({
          id,
          name: muni.name,
          state: muni.state,
        })),
        total: Object.keys(MUNICIPALITIES).length,
        message: 'Call POST /scrape with each municipalityId',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Municode Scraper Worker\n\nEndpoints:\n  GET /list\n  POST /scrape\n  POST /scrape-all', {
      headers: corsHeaders,
    });
  },
};

/**
 * Parse zoning districts from Municode HTML
 */
function parseZoningDistricts(html, municipalityId, municipality) {
  const districts = [];

  // Extract text content (strip HTML tags)
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  // Find district codes (R-1, C-2, I-1, etc.)
  const districtPattern = /\b([A-Z]{1,3}[-\s]?\d{1,2}[A-Z]?)\b/g;
  const matches = text.matchAll(districtPattern);
  const codes = [...new Set([...matches].map(m => m[1]))];

  console.log(`Found ${codes.length} potential district codes`);

  // For each code, try to extract parameters
  for (const code of codes.slice(0, 50)) { // Limit to 50 to avoid timeout
    const district = extractDistrictInfo(text, code, municipalityId);
    if (district) {
      districts.push(district);
    }
  }

  return districts;
}

/**
 * Extract district information from text
 */
function extractDistrictInfo(text, code, municipalityId) {
  // Find section containing this district code
  const codeRegex = new RegExp(`${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s]+([^\\n]{0,200})`, 'i');
  const match = text.match(codeRegex);
  
  if (!match) return null;

  const section = match[0] + text.slice(match.index, match.index + 2000);

  const district = {
    municipality_id: municipalityId,
    zoning_code: code,
    district_name: extractDistrictName(section, code),
  };

  // Extract density
  const density = extractDensity(section);
  if (density) district.max_density_per_acre = density;

  // Extract FAR
  const far = extractFAR(section);
  if (far) district.max_far = far;

  // Extract height
  const height = extractHeight(section);
  if (height.feet) district.max_height_feet = height.feet;
  if (height.stories) district.max_stories = height.stories;

  // Extract parking
  const parking = extractParking(section);
  if (parking) district.min_parking_per_unit = parking;

  // Only return if we found at least one parameter
  if (density || far || height.feet || parking) {
    return district;
  }

  return null;
}

function extractDistrictName(section, code) {
  const nameMatch = section.match(new RegExp(`${code}[:\\s]*([^\\n.]{5,100})`, 'i'));
  return nameMatch ? nameMatch[1].trim() : code;
}

function extractDensity(text) {
  const patterns = [
    /density[:\s]+(\d+\.?\d*)\s*(?:units?|du|dwelling\s*units?)\s*per\s*acre/i,
    /(\d+\.?\d*)\s*(?:units?|du)\s*per\s*acre/i,
    /maximum\s*density[:\s]+(\d+\.?\d*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function extractFAR(text) {
  const patterns = [
    /FAR[:\s]+(\d+\.?\d*)/i,
    /floor\s*area\s*ratio[:\s]+(\d+\.?\d*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function extractHeight(text) {
  const result = {};

  // Feet
  const feetMatch = text.match(/(?:height|maximum)[:\s]+(\d+)\s*(?:feet|ft)/i);
  if (feetMatch) result.feet = parseInt(feetMatch[1]);

  // Stories
  const storyMatch = text.match(/(\d+)\s*stor(?:y|ies)/i);
  if (storyMatch) result.stories = parseInt(storyMatch[1]);

  return result;
}

function extractParking(text) {
  const patterns = [
    /parking[:\s]+(\d+\.?\d*)\s*spaces?\s*per\s*(?:unit|dwelling)/i,
    /(\d+\.?\d*)\s*spaces?\s*per\s*unit/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}
