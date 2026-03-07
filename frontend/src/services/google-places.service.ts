/**
 * Property Photos Service - Hybrid approach
 * 1. Try scraped photos from database first (Zillow, Redfin, etc.)
 * 2. Fallback to Google Places API
 * 3. Final fallback to styled placeholders
 */

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export interface PropertyPhoto {
  id: string;
  url: string;
  label: string;
  width: number;
  height: number;
  source: 'scraped' | 'google' | 'placeholder';
  color?: string; // For placeholder rendering
}

/**
 * Main entry point: Get property photos with hybrid fallback
 * 1. Use scraped photos if available
 * 2. Try Google Places API
 * 3. Use placeholders
 */
export async function getPropertyPhotos(property: {
  photos?: any[]; // From database (scraped photos)
  address: string;
  city: string;
  state: string;
  zip: string;
}): Promise<PropertyPhoto[]> {
  // 1. Try scraped photos first
  if (property.photos && Array.isArray(property.photos) && property.photos.length > 0) {
    console.log(`Using ${property.photos.length} scraped photos`);
    return property.photos.map((p, i) => ({
      id: `scraped-${i}`,
      url: p.url || '',
      label: p.label || `Photo ${i + 1}`,
      width: 1600,
      height: 1200,
      source: 'scraped' as const,
    }));
  }

  // 2. Fallback to Google Places
  console.log('No scraped photos, trying Google Places API...');
  const googlePhotos = await fetchGooglePlacesPhotos(
    property.address,
    property.city,
    property.state,
    property.zip
  );
  
  if (googlePhotos.length > 0 && googlePhotos[0].source === 'google') {
    return googlePhotos;
  }

  // 3. Final fallback to placeholders
  console.log('No photos available, using placeholders');
  return getPlaceholderPhotos();
}

/**
 * Fetch photos from Google Places API
 */
async function fetchGooglePlacesPhotos(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<PropertyPhoto[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Google Places API key not configured, using placeholders');
    return getPlaceholderPhotos();
  }

  try {
    const query = `${address}, ${city}, ${state} ${zip}`;
    
    // Step 1: Find Place
    const findResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
      new URLSearchParams({
        input: query,
        inputtype: 'textquery',
        fields: 'place_id,name,formatted_address',
        key: GOOGLE_PLACES_API_KEY,
      })
    );

    const findData = await findResponse.json();
    
    if (!findData.candidates || findData.candidates.length === 0) {
      console.warn('No place found for address:', query);
      return getPlaceholderPhotos();
    }

    const placeId = findData.candidates[0].place_id;

    // Step 2: Get Place Details with photos
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      new URLSearchParams({
        place_id: placeId,
        fields: 'photos',
        key: GOOGLE_PLACES_API_KEY,
      })
    );

    const detailsData = await detailsResponse.json();

    if (!detailsData.result?.photos || detailsData.result.photos.length === 0) {
      console.warn('No photos found for place:', placeId);
      return getPlaceholderPhotos();
    }

    // Step 3: Build photo URLs
    const photos: PropertyPhoto[] = detailsData.result.photos.map((photo: any, index: number) => ({
      id: `google-${index}`,
      url: `https://maps.googleapis.com/maps/api/place/photo?` +
        new URLSearchParams({
          maxwidth: '1600',
          photo_reference: photo.photo_reference,
          key: GOOGLE_PLACES_API_KEY,
        }).toString(),
      label: index === 0 ? 'Exterior' : `View ${index + 1}`,
      width: photo.width || 1600,
      height: photo.height || 1200,
      source: 'google' as const,
    }));

    return photos;
  } catch (error) {
    console.error('Error fetching Google Places photos:', error);
    return getPlaceholderPhotos();
  }
}

/**
 * Fallback placeholder photos (styled for Bloomberg Terminal aesthetic)
 */
function getPlaceholderPhotos(): PropertyPhoto[] {
  return [
    { id: '1', url: '', label: 'Exterior', width: 1600, height: 900, source: 'placeholder', color: '#1a2744' },
    { id: '2', url: '', label: 'Pool Area', width: 1600, height: 900, source: 'placeholder', color: '#1a3a2a' },
    { id: '3', url: '', label: 'Fitness Center', width: 1600, height: 900, source: 'placeholder', color: '#2a1a3a' },
    { id: '4', url: '', label: 'Unit Interior', width: 1600, height: 900, source: 'placeholder', color: '#3a2a1a' },
    { id: '5', url: '', label: 'Kitchen', width: 1600, height: 900, source: 'placeholder', color: '#1a3a3a' },
    { id: '6', url: '', label: 'Aerial View', width: 1600, height: 900, source: 'placeholder', color: '#2a2a1a' },
    { id: '7', url: '', label: 'Lobby', width: 1600, height: 900, source: 'placeholder', color: '#1a2a3a' },
    { id: '8', url: '', label: 'Parking', width: 1600, height: 900, source: 'placeholder', color: '#2a1a2a' },
  ];
}

/**
 * Get Street View image URL for a property
 */
export function getStreetViewUrl(
  address: string,
  city: string,
  state: string,
  zip: string,
  width = 1600,
  height = 900
): string {
  if (!GOOGLE_PLACES_API_KEY) {
    return '';
  }

  const location = `${address}, ${city}, ${state} ${zip}`;
  
  return `https://maps.googleapis.com/maps/api/streetview?` +
    new URLSearchParams({
      size: `${width}x${height}`,
      location,
      key: GOOGLE_PLACES_API_KEY,
    }).toString();
}
