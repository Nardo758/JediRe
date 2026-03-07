/**
 * Google Places API service for property photos
 * Fetches property images via Google Places API
 */

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export interface PropertyPhoto {
  id: string;
  url: string;
  label: string;
  width: number;
  height: number;
  source: 'google' | 'placeholder';
}

/**
 * Fetch photos for a property address using Google Places API
 */
export async function fetchPropertyPhotos(
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
 * Fallback placeholder photos when Google API unavailable
 */
function getPlaceholderPhotos(): PropertyPhoto[] {
  return [
    { id: '1', url: '', label: 'Exterior', width: 1600, height: 900, source: 'placeholder' },
    { id: '2', url: '', label: 'Pool Area', width: 1600, height: 900, source: 'placeholder' },
    { id: '3', url: '', label: 'Fitness Center', width: 1600, height: 900, source: 'placeholder' },
    { id: '4', url: '', label: 'Unit Interior', width: 1600, height: 900, source: 'placeholder' },
    { id: '5', url: '', label: 'Kitchen', width: 1600, height: 900, source: 'placeholder' },
    { id: '6', url: '', label: 'Aerial View', width: 1600, height: 900, source: 'placeholder' },
    { id: '7', url: '', label: 'Lobby', width: 1600, height: 900, source: 'placeholder' },
    { id: '8', url: '', label: 'Parking', width: 1600, height: 900, source: 'placeholder' },
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
