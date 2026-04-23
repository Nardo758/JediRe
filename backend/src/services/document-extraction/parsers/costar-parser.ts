/**
 * CoStar Property Summary Parser
 * 
 * Extracts structured data from CoStar PDF reports including:
 * - Property Summary (units, year built, stories, vacancy, asking rent)
 * - Property Details (land area, FAR, buildings, avg unit size, zoning, parcel)
 * - Amenities (unit and site)
 * - Unit Mix (beds, baths, sqft, units, rent per unit/SF)
 * - Transportation (traffic volume, airport, walkability scores)
 * - Contacts (owner, management)
 */

import { logger } from '../../../utils/logger';

export interface CoStarPropertyData {
  // Property Summary
  propertyName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  submarket: string;
  propertyType: string;
  
  // Core metrics
  units: number | null;
  yearBuilt: number | null;
  stories: number | null;
  elevators: string | null;
  marketSegment: string | null;
  vacancyPct: number | null;
  askingRentPerUnit: number | null;
  
  // Property Details
  landAreaAcres: number | null;
  landAreaSF: number | null;
  buildingFAR: number | null;
  numberOfBuildings: number | null;
  unitsPerArea: number | null;
  avgUnitSizeSF: number | null;
  zoning: string | null;
  parcelNumber: string | null;
  
  // Amenities
  unitAmenities: string[];
  siteAmenities: string[];
  
  // Unit Mix
  unitMix: UnitMixRow[];
  unitMixTotals: UnitMixTotals | null;
  
  // Transportation
  trafficVolume: string | null;
  airport: string | null;
  airportDriveTime: string | null;
  pedestrianScore: number | null;
  cyclingScore: number | null;
  carScore: number | null;
  transitScore: number | null;
  
  // Contacts
  recordedOwner: string | null;
  trueOwner: string | null;
  trueOwnerLocation: string | null;
  trueOwnerPhone: string | null;
  propertyManagement: string | null;
  propertyManagementLocation: string | null;
  propertyManagementPhone: string | null;
  
  // Meta
  reportDate: string | null;
  costarId: string | null;
  starRating: number | null;
}

export interface UnitMixRow {
  beds: number;
  baths: number;
  avgSF: number;
  unitCount: number;
  mixPct: number;
  unitsAvailable: number;
  availablePct: number;
  askingRentPerUnit: number;
  askingRentPerSF: number;
  effectiveRentPerUnit: number;
  effectiveRentPerSF: number;
  concessionPct: number;
}

export interface UnitMixTotals {
  totalUnits: number;
  avgSF: number;
  unitsAvailable: number;
  availablePct: number;
  avgAskingRentPerUnit: number;
  avgAskingRentPerSF: number;
  avgEffectiveRentPerUnit: number;
  avgEffectiveRentPerSF: number;
  avgConcessionPct: number;
}

/**
 * Parse CoStar Property Summary PDF text
 */
export function parseCoStarText(text: string): { success: boolean; data?: CoStarPropertyData; error?: string; warnings?: string[] } {
  const warnings: string[] = [];
  
  try {
    // Check if this is a CoStar report
    if (!text.includes('CoStar') && !text.includes('Property Summary')) {
      return { success: false, error: 'Not a CoStar Property Summary report' };
    }
    
    const data: CoStarPropertyData = {
      propertyName: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      county: '',
      submarket: '',
      propertyType: '',
      units: null,
      yearBuilt: null,
      stories: null,
      elevators: null,
      marketSegment: null,
      vacancyPct: null,
      askingRentPerUnit: null,
      landAreaAcres: null,
      landAreaSF: null,
      buildingFAR: null,
      numberOfBuildings: null,
      unitsPerArea: null,
      avgUnitSizeSF: null,
      zoning: null,
      parcelNumber: null,
      unitAmenities: [],
      siteAmenities: [],
      unitMix: [],
      unitMixTotals: null,
      trafficVolume: null,
      airport: null,
      airportDriveTime: null,
      pedestrianScore: null,
      cyclingScore: null,
      carScore: null,
      transitScore: null,
      recordedOwner: null,
      trueOwner: null,
      trueOwnerLocation: null,
      trueOwnerPhone: null,
      propertyManagement: null,
      propertyManagementLocation: null,
      propertyManagementPhone: null,
      reportDate: null,
      costarId: null,
      starRating: null,
    };
    
    // Extract property name and address (first line after "Property Summary")
    const headerMatch = text.match(/(\d+\s+[A-Za-z0-9\s\-\.]+(?:Loop|St|Ave|Rd|Dr|Blvd|Way|Ln|Ct|Cir|Pl|Pkwy))\s*[-–]\s*([A-Za-z0-9\s\-\.]+)/i);
    if (headerMatch) {
      data.address = headerMatch[1].trim();
      data.propertyName = headerMatch[2].trim();
    }
    
    // Extract location (city, state, zip, county, submarket)
    const locationMatch = text.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:\s*\(([^)]+)\))?\s*[-–]\s*([A-Za-z\s]+Submarket)/i);
    if (locationMatch) {
      data.city = locationMatch[1].trim();
      data.state = locationMatch[2].trim();
      data.zipCode = locationMatch[3].trim();
      if (locationMatch[4]) data.county = locationMatch[4].replace('County', '').trim();
      if (locationMatch[5]) data.submarket = locationMatch[5].trim();
    }
    
    // Extract property type
    const typeMatch = text.match(/Apartments|Multifamily|Senior Living|Student Housing/i);
    if (typeMatch) {
      data.propertyType = typeMatch[0];
    }
    
    // Extract Units
    const unitsMatch = text.match(/Units\s+(\d+)/i);
    if (unitsMatch) {
      data.units = parseInt(unitsMatch[1]);
    }
    
    // Extract Year Built
    const builtMatch = text.match(/Built\s+(\d{4})/i);
    if (builtMatch) {
      data.yearBuilt = parseInt(builtMatch[1]);
    }
    
    // Extract Stories
    const storiesMatch = text.match(/Stories\s+(\d+)/i);
    if (storiesMatch) {
      data.stories = parseInt(storiesMatch[1]);
    }
    
    // Extract Elevators
    const elevatorsMatch = text.match(/Elevators\s+(Walk\s*Up|Yes|No|\d+)/i);
    if (elevatorsMatch) {
      data.elevators = elevatorsMatch[1].trim();
    }
    
    // Extract Market Segment
    const segmentMatch = text.match(/Market\s*Segment\s+(\w+)/i);
    if (segmentMatch) {
      data.marketSegment = segmentMatch[1];
    }
    
    // Extract Vacancy %
    const vacancyMatch = text.match(/Vacancy\s*%?\s+([\d.]+)/i);
    if (vacancyMatch) {
      data.vacancyPct = parseFloat(vacancyMatch[1]);
    }
    
    // Extract Asking Rent Per Unit
    const rentMatch = text.match(/Asking\s*Rent\s*Per\s*Unit\s+\$?([\d,]+)/i);
    if (rentMatch) {
      data.askingRentPerUnit = parseFloat(rentMatch[1].replace(/,/g, ''));
    }
    
    // Extract Land Area
    const landMatch = text.match(/Land\s*Area\s+([\d.]+)\s*AC\s*\(([\d,]+)\s*SF\)/i);
    if (landMatch) {
      data.landAreaAcres = parseFloat(landMatch[1]);
      data.landAreaSF = parseFloat(landMatch[2].replace(/,/g, ''));
    }
    
    // Extract Building FAR
    const farMatch = text.match(/Building\s*FAR\s+([\d.]+)/i);
    if (farMatch) {
      data.buildingFAR = parseFloat(farMatch[1]);
    }
    
    // Extract Number of Buildings
    const buildingsMatch = text.match(/Number\s*of\s*Buildings\s+(\d+)/i);
    if (buildingsMatch) {
      data.numberOfBuildings = parseInt(buildingsMatch[1]);
    }
    
    // Extract Units Per Area
    const unitsPerAreaMatch = text.match(/Units\s*Per\s*Area\s+([\d.]+)\/AC/i);
    if (unitsPerAreaMatch) {
      data.unitsPerArea = parseFloat(unitsPerAreaMatch[1]);
    }
    
    // Extract Average Unit Size
    const avgSizeMatch = text.match(/Average\s*Unit\s*Size\s+([\d,]+)\s*SF/i);
    if (avgSizeMatch) {
      data.avgUnitSizeSF = parseFloat(avgSizeMatch[1].replace(/,/g, ''));
    }
    
    // Extract Zoning
    const zoningMatch = text.match(/Zoning\s+([A-Z0-9\-]+)/i);
    if (zoningMatch) {
      data.zoning = zoningMatch[1];
    }
    
    // Extract Parcel
    const parcelMatch = text.match(/Parcel\s+([\d\-]+)/i);
    if (parcelMatch) {
      data.parcelNumber = parcelMatch[1];
    }
    
    // Extract Unit Amenities
    const unitAmenitiesSection = text.match(/Unit\s*Amenities([\s\S]*?)(?:Site\s*Amenities|Unit\s*Mix)/i);
    if (unitAmenitiesSection) {
      const amenityText = unitAmenitiesSection[1];
      const amenities = amenityText.match(/[•·]\s*([A-Za-z\s\/\-]+)/g);
      if (amenities) {
        data.unitAmenities = amenities.map(a => a.replace(/[•·]\s*/, '').trim()).filter(a => a.length > 0);
      }
    }
    
    // Extract Site Amenities
    const siteAmenitiesSection = text.match(/Site\s*Amenities([\s\S]*?)(?:Unit\s*Mix|Available\s*Spaces)/i);
    if (siteAmenitiesSection) {
      const amenityText = siteAmenitiesSection[1];
      const amenities = amenityText.match(/[•·]\s*([A-Za-z\s\/\-]+)/g);
      if (amenities) {
        data.siteAmenities = amenities.map(a => a.replace(/[•·]\s*/, '').trim()).filter(a => a.length > 0);
      }
    }
    
    // Extract Unit Mix rows
    // Pattern: Beds Baths AvgSF Units Mix% AvailUnits Avail% RentPerUnit RentPerSF EffRentPerUnit EffRentPerSF Concession%
    const unitMixRows = text.matchAll(/(\d+)\s+(\d+)\s+([\d,]+)\s+(\d+)\s+([\d.]+)%\s+(\d+)\s+([\d.]+)%\s+\$([\d,]+)\s+\$([\d.]+)\s+\$([\d,]+)\s+\$([\d.]+)\s+([\d.]+)%/g);
    for (const match of unitMixRows) {
      data.unitMix.push({
        beds: parseInt(match[1]),
        baths: parseInt(match[2]),
        avgSF: parseFloat(match[3].replace(/,/g, '')),
        unitCount: parseInt(match[4]),
        mixPct: parseFloat(match[5]),
        unitsAvailable: parseInt(match[6]),
        availablePct: parseFloat(match[7]),
        askingRentPerUnit: parseFloat(match[8].replace(/,/g, '')),
        askingRentPerSF: parseFloat(match[9]),
        effectiveRentPerUnit: parseFloat(match[10].replace(/,/g, '')),
        effectiveRentPerSF: parseFloat(match[11]),
        concessionPct: parseFloat(match[12]),
      });
    }
    
    // Extract Totals row
    const totalsMatch = text.match(/Totals\s+([\d,]+)\s+(\d+)\s+100%\s+(\d+)\s+([\d.]+)%\s+\$([\d,]+)\s+\$([\d.]+)\s+\$([\d,]+)\s+\$([\d.]+)\s+([\d.]+)%/i);
    if (totalsMatch) {
      data.unitMixTotals = {
        avgSF: parseFloat(totalsMatch[1].replace(/,/g, '')),
        totalUnits: parseInt(totalsMatch[2]),
        unitsAvailable: parseInt(totalsMatch[3]),
        availablePct: parseFloat(totalsMatch[4]),
        avgAskingRentPerUnit: parseFloat(totalsMatch[5].replace(/,/g, '')),
        avgAskingRentPerSF: parseFloat(totalsMatch[6]),
        avgEffectiveRentPerUnit: parseFloat(totalsMatch[7].replace(/,/g, '')),
        avgEffectiveRentPerSF: parseFloat(totalsMatch[8]),
        avgConcessionPct: parseFloat(totalsMatch[9]),
      };
    }
    
    // Extract Transportation
    const trafficMatch = text.match(/Traffic\s*Volume\s+([\s\S]*?)(?=Airport|Pedestrian)/i);
    if (trafficMatch) {
      data.trafficVolume = trafficMatch[1].trim().substring(0, 500);
    }
    
    const airportMatch = text.match(/Airport\s+([A-Za-z\s]+International)\s+(\d+\s*min\s*drive)/i);
    if (airportMatch) {
      data.airport = airportMatch[1].trim();
      data.airportDriveTime = airportMatch[2].trim();
    }
    
    const pedestrianMatch = text.match(/Pedestrian\s*Friendly\s+(\d+)/i);
    if (pedestrianMatch) {
      data.pedestrianScore = parseInt(pedestrianMatch[1]);
    }
    
    const cyclingMatch = text.match(/Cycling\s*Friendly\s+(\d+)/i);
    if (cyclingMatch) {
      data.cyclingScore = parseInt(cyclingMatch[1]);
    }
    
    const carMatch = text.match(/Car\s*Friendly\s+(\d+)/i);
    if (carMatch) {
      data.carScore = parseInt(carMatch[1]);
    }
    
    const transitMatch = text.match(/Transit\s*Friendly\s+(\d+)/i);
    if (transitMatch) {
      data.transitScore = parseInt(transitMatch[1]);
    }
    
    // Extract Contacts
    const ownerMatch = text.match(/Recorded\s*Owner\s+([A-Z0-9\s\-\.]+LLC)/i);
    if (ownerMatch) {
      data.recordedOwner = ownerMatch[1].trim();
    }
    
    const trueOwnerMatch = text.match(/True\s*Owner\s+([A-Za-z\s\-\.]+)\s+([A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})\s+\(([\d\-]+)\)/i);
    if (trueOwnerMatch) {
      data.trueOwner = trueOwnerMatch[1].trim();
      data.trueOwnerLocation = trueOwnerMatch[2].trim();
      data.trueOwnerPhone = trueOwnerMatch[3].trim();
    }
    
    const mgmtMatch = text.match(/Property\s*Management\s+([A-Za-z\s\-\.]+)\s+([A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})\s+\(([\d\-]+)\)/i);
    if (mgmtMatch) {
      data.propertyManagement = mgmtMatch[1].trim();
      data.propertyManagementLocation = mgmtMatch[2].trim();
      data.propertyManagementPhone = mgmtMatch[3].trim();
    }
    
    // Extract Report Date
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      data.reportDate = dateMatch[1];
    }
    
    // Extract CoStar ID from license text
    const costarIdMatch = text.match(/MAG\s*[-–]\s*([A-Za-z\s]+)\s*[-–]\s*(\d+)/i);
    if (costarIdMatch) {
      data.costarId = costarIdMatch[2];
    }
    
    // Star rating
    const starMatch = text.match(/([★☆]{1,5})|(\d+(?:\.\d+)?\s*(?:star|\/5))/i);
    if (starMatch) {
      // Count filled stars or parse number
      if (starMatch[1]) {
        data.starRating = (starMatch[1].match(/★/g) || []).length;
      } else if (starMatch[2]) {
        data.starRating = parseFloat(starMatch[2]);
      }
    }
    
    // Validate we got essential data
    if (!data.units && !data.propertyName) {
      return { success: false, error: 'Could not extract essential property data' };
    }
    
    // Add warnings for missing data
    if (!data.yearBuilt) warnings.push('Year built not found');
    if (!data.askingRentPerUnit) warnings.push('Asking rent not found');
    if (data.unitMix.length === 0) warnings.push('Unit mix table not parsed');
    
    return { success: true, data, warnings };
    
  } catch (err) {
    logger.error('CoStar parser error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Parse error' };
  }
}

/**
 * Parse CoStar PDF buffer
 */
export async function parseCoStarPDF(buffer: Buffer, filename: string): Promise<{ success: boolean; data?: CoStarPropertyData; error?: string; warnings?: string[] }> {
  try {
    // Use pdf-parse to extract text
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);
    
    return parseCoStarText(pdfData.text);
  } catch (err) {
    logger.error('CoStar PDF parse error:', err);
    return { success: false, error: `PDF extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

/**
 * Convert CoStar data to data_library_assets format
 */
export function costarToDataLibraryAsset(costar: CoStarPropertyData): Record<string, unknown> {
  const occupancyPct = costar.vacancyPct !== null ? 100 - costar.vacancyPct : null;
  
  // Infer asset class from year built and rent levels
  let assetClass: string | null = null;
  if (costar.yearBuilt) {
    if (costar.yearBuilt >= 2020) assetClass = 'A';
    else if (costar.yearBuilt >= 2000) assetClass = 'B';
    else if (costar.yearBuilt >= 1980) assetClass = 'C';
    else assetClass = 'D';
  }
  
  // Property type from stories
  let propertyType = 'garden';
  if (costar.stories) {
    if (costar.stories <= 3) propertyType = 'garden';
    else if (costar.stories <= 6) propertyType = 'mid-rise';
    else propertyType = 'high-rise';
  }
  
  // Vintage band
  let vintageBand: string | null = null;
  if (costar.yearBuilt) {
    if (costar.yearBuilt < 1980) vintageBand = 'pre-1980';
    else if (costar.yearBuilt < 2000) vintageBand = '1980-1999';
    else if (costar.yearBuilt < 2010) vintageBand = '2000-2009';
    else if (costar.yearBuilt < 2020) vintageBand = '2010-2019';
    else vintageBand = '2020+';
  }
  
  // Unit count band
  let unitCountBand: string | null = null;
  if (costar.units) {
    if (costar.units < 100) unitCountBand = '<100';
    else if (costar.units < 200) unitCountBand = '100-199';
    else if (costar.units < 300) unitCountBand = '200-299';
    else if (costar.units < 400) unitCountBand = '300-399';
    else unitCountBand = '400+';
  }
  
  // Calculate data quality score
  let dqScore = 0;
  if (costar.city && costar.state) dqScore += 10;
  if (costar.units) dqScore += 10;
  if (costar.yearBuilt) dqScore += 10;
  if (costar.askingRentPerUnit) dqScore += 10;
  if (costar.vacancyPct !== null) dqScore += 10;
  if (costar.unitMix.length > 0) dqScore += 15;
  if (costar.avgUnitSizeSF) dqScore += 5;
  if (costar.landAreaAcres) dqScore += 5;
  if (costar.unitAmenities.length > 0) dqScore += 5;
  if (costar.siteAmenities.length > 0) dqScore += 5;
  if (costar.trueOwner) dqScore += 5;
  if (costar.propertyManagement) dqScore += 5;
  if (costar.zoning) dqScore += 5;
  
  return {
    property_name: costar.propertyName || `${costar.address}`,
    address: costar.address,
    city: costar.city,
    state: costar.state,
    zip_code: costar.zipCode,
    county: costar.county,
    submarket_name: costar.submarket,
    property_type: propertyType,
    asset_class: assetClass,
    unit_count: costar.units,
    year_built: costar.yearBuilt,
    stories: costar.stories,
    avg_unit_sqft: costar.avgUnitSizeSF,
    lot_size_acres: costar.landAreaAcres,
    density_units_per_acre: costar.unitsPerArea,
    avg_rent: costar.askingRentPerUnit,
    occupancy_pct: occupancyPct ? occupancyPct / 100 : null,
    vintage_band: vintageBand,
    unit_count_band: unitCountBand,
    source_type: 'costar',
    data_quality_score: Math.min(dqScore, 100),
    amenities: [...costar.unitAmenities, ...costar.siteAmenities],
    unit_mix: costar.unitMix,
    owner_operator: costar.trueOwner,
    management_company: costar.propertyManagement,
    extraction_data: {
      costar_id: costar.costarId,
      report_date: costar.reportDate,
      star_rating: costar.starRating,
      zoning: costar.zoning,
      parcel: costar.parcelNumber,
      far: costar.buildingFAR,
      num_buildings: costar.numberOfBuildings,
      elevators: costar.elevators,
      market_segment: costar.marketSegment,
      transportation: {
        airport: costar.airport,
        airport_drive_time: costar.airportDriveTime,
        pedestrian_score: costar.pedestrianScore,
        cycling_score: costar.cyclingScore,
        car_score: costar.carScore,
        transit_score: costar.transitScore,
        traffic_volume: costar.trafficVolume,
      },
      contacts: {
        recorded_owner: costar.recordedOwner,
        true_owner: costar.trueOwner,
        true_owner_location: costar.trueOwnerLocation,
        true_owner_phone: costar.trueOwnerPhone,
        property_management: costar.propertyManagement,
        property_management_location: costar.propertyManagementLocation,
        property_management_phone: costar.propertyManagementPhone,
      },
    },
    parse_status: 'complete',
    parsed_at: new Date(),
  };
}
