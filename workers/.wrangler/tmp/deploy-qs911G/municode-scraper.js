var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// municode-scraper.js
var MUNICIPALITIES = {
  "birmingham-al": {
    name: "Birmingham",
    state: "AL",
    municodeUrl: "https://library.municode.com/al/birmingham/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=COOR_TITZOZORE"
  },
  "montgomery-al": {
    name: "Montgomery",
    state: "AL",
    municodeUrl: "https://library.municode.com/al/montgomery/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=PTIICOOR_CH13ZO"
  },
  "louisville-ky": {
    name: "Louisville",
    state: "KY",
    municodeUrl: "https://library.municode.com/ky/louisville/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=CD_ORD_CH4LADECO"
  },
  "lexington-ky": {
    name: "Lexington",
    state: "KY",
    municodeUrl: "https://library.municode.com/ky/lexington-fayette_county/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=COOR_ARTIZOOR"
  },
  "fort-worth-tx": {
    name: "Fort Worth",
    state: "TX",
    municodeUrl: "https://library.municode.com/tx/fort_worth/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=COOR_CH14ZO"
  },
  "el-paso-tx": {
    name: "El Paso",
    state: "TX",
    municodeUrl: "https://library.municode.com/tx/el_paso/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=TIT20ZO"
  },
  // Florida Cities
  "st-petersburg-fl": {
    name: "St. Petersburg",
    state: "FL",
    municodeUrl: "https://library.municode.com/fl/st._petersburg/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=PTIICOOR_CH16ZO"
  },
  "hialeah-fl": {
    name: "Hialeah",
    state: "FL",
    municodeUrl: "https://library.municode.com/fl/hialeah/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=PTIICOOR_CH29ZO"
  },
  "cape-coral-fl": {
    name: "Cape Coral",
    state: "FL",
    municodeUrl: "https://library.municode.com/fl/cape_coral/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=PTIIICOOR_CH27ZO"
  },
  "port-st-lucie-fl": {
    name: "Port St. Lucie",
    state: "FL",
    municodeUrl: "https://library.municode.com/fl/port_st._lucie/codes/code_of_ordinances",
    zoningChapterPath: "?nodeId=COOR_CH19UNDECO"
  }
};
var municode_scraper_default = {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/list") {
      return new Response(JSON.stringify({
        municipalities: Object.keys(MUNICIPALITIES),
        count: Object.keys(MUNICIPALITIES).length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (request.method === "POST" && url.pathname === "/scrape") {
      try {
        const body = await request.json();
        const { municipalityId } = body;
        if (!municipalityId) {
          return new Response(JSON.stringify({ error: "Missing municipalityId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const municipality = MUNICIPALITIES[municipalityId];
        if (!municipality) {
          return new Response(JSON.stringify({ error: "Municipality not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const municodeUrl = `${municipality.municodeUrl}${municipality.zoningChapterPath}`;
        console.log(`Fetching: ${municodeUrl}`);
        const response = await fetch(municodeUrl, {
          headers: {
            "User-Agent": "JEDI-RE-Zoning-Research/1.0 (Educational Purpose)"
          }
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch Municode: ${response.status}`);
        }
        const html = await response.text();
        const districts = parseZoningDistricts(html, municipalityId, municipality);
        return new Response(JSON.stringify({
          success: true,
          municipality: municipality.name,
          state: municipality.state,
          districtsFound: districts.length,
          districts,
          scrapedAt: (/* @__PURE__ */ new Date()).toISOString()
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    if (request.method === "POST" && url.pathname === "/scrape-all") {
      return new Response(JSON.stringify({
        municipalities: Object.entries(MUNICIPALITIES).map(([id, muni]) => ({
          id,
          name: muni.name,
          state: muni.state
        })),
        total: Object.keys(MUNICIPALITIES).length,
        message: "Call POST /scrape with each municipalityId"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return new Response("Municode Scraper Worker\n\nEndpoints:\n  GET /list\n  POST /scrape\n  POST /scrape-all", {
      headers: corsHeaders
    });
  }
};
function parseZoningDistricts(html, municipalityId, municipality) {
  const districts = [];
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const districtPattern = /\b([A-Z]{1,3}[-\s]?\d{1,2}[A-Z]?)\b/g;
  const matches = text.matchAll(districtPattern);
  const codes = [...new Set([...matches].map((m) => m[1]))];
  console.log(`Found ${codes.length} potential district codes`);
  for (const code of codes.slice(0, 50)) {
    const district = extractDistrictInfo(text, code, municipalityId);
    if (district) {
      districts.push(district);
    }
  }
  return districts;
}
__name(parseZoningDistricts, "parseZoningDistricts");
function extractDistrictInfo(text, code, municipalityId) {
  const codeRegex = new RegExp(`${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[:\\s]+([^\\n]{0,200})`, "i");
  const match = text.match(codeRegex);
  if (!match) return null;
  const section = match[0] + text.slice(match.index, match.index + 2e3);
  const district = {
    municipality_id: municipalityId,
    zoning_code: code,
    district_name: extractDistrictName(section, code)
  };
  const density = extractDensity(section);
  if (density) district.max_density_per_acre = density;
  const far = extractFAR(section);
  if (far) district.max_far = far;
  const height = extractHeight(section);
  if (height.feet) district.max_height_feet = height.feet;
  if (height.stories) district.max_stories = height.stories;
  const parking = extractParking(section);
  if (parking) district.min_parking_per_unit = parking;
  if (density || far || height.feet || parking) {
    return district;
  }
  return null;
}
__name(extractDistrictInfo, "extractDistrictInfo");
function extractDistrictName(section, code) {
  const nameMatch = section.match(new RegExp(`${code}[:\\s]*([^\\n.]{5,100})`, "i"));
  return nameMatch ? nameMatch[1].trim() : code;
}
__name(extractDistrictName, "extractDistrictName");
function extractDensity(text) {
  const patterns = [
    /density[:\s]+(\d+\.?\d*)\s*(?:units?|du|dwelling\s*units?)\s*per\s*acre/i,
    /(\d+\.?\d*)\s*(?:units?|du)\s*per\s*acre/i,
    /maximum\s*density[:\s]+(\d+\.?\d*)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}
__name(extractDensity, "extractDensity");
function extractFAR(text) {
  const patterns = [
    /FAR[:\s]+(\d+\.?\d*)/i,
    /floor\s*area\s*ratio[:\s]+(\d+\.?\d*)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}
__name(extractFAR, "extractFAR");
function extractHeight(text) {
  const result = {};
  const feetMatch = text.match(/(?:height|maximum)[:\s]+(\d+)\s*(?:feet|ft)/i);
  if (feetMatch) result.feet = parseInt(feetMatch[1]);
  const storyMatch = text.match(/(\d+)\s*stor(?:y|ies)/i);
  if (storyMatch) result.stories = parseInt(storyMatch[1]);
  return result;
}
__name(extractHeight, "extractHeight");
function extractParking(text) {
  const patterns = [
    /parking[:\s]+(\d+\.?\d*)\s*spaces?\s*per\s*(?:unit|dwelling)/i,
    /(\d+\.?\d*)\s*spaces?\s*per\s*unit/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}
__name(extractParking, "extractParking");
export {
  municode_scraper_default as default
};
//# sourceMappingURL=municode-scraper.js.map
