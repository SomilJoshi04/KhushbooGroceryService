/**
 * Provider-Independent Map and Geocoding Service Adapter.
 *
 * Current Provider: Leaflet + OpenStreetMap Nominatim
 * Future Ready: Google Maps Platform (via MAP_PROVIDER configuration)
 *
 * Capabilities:
 * - searchPlaces(query, signal): debounced location autocomplete with abort signal.
 * - reverseGeocode(lat, lng, signal): resolves coordinates to structured Indian address fields.
 * - calculateDistanceKm(lat1, lon1, lat2, lon2): Haversine distance with road winding factor.
 * - isWithinOperatingRegion(lat, lng): validates coordinates and regional bounds.
 *
 * @module services/mapProvider
 */

// Configurable default hub coordinates (Indore, M.P.)
export const DEFAULT_MAP_CENTER = {
  lat: 22.7196,
  lng: 75.8577,
  city: 'Indore',
  state: 'Madhya Pradesh',
  pincode: '452001',
};

// Operating region bounds: Madhya Pradesh / Central India
export const OPERATING_BOUNDS = {
  minLat: 21.0,
  maxLat: 26.9,
  minLng: 74.0,
  maxLng: 82.8,
  primaryCity: 'Indore',
  primaryState: 'Madhya Pradesh',
};

/**
 * Validates whether coordinates are numeric and within operating region bounds.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {{ valid: boolean, inOperatingRegion: boolean, message?: string }}
 */
export function isWithinOperatingRegion(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return { valid: false, inOperatingRegion: false, message: 'Invalid geographic coordinates.' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, inOperatingRegion: false, message: 'Coordinates out of Earth range (-90..90, -180..180).' };
  }

  const inRegion =
    lat >= OPERATING_BOUNDS.minLat &&
    lat <= OPERATING_BOUNDS.maxLat &&
    lng >= OPERATING_BOUNDS.minLng &&
    lng <= OPERATING_BOUNDS.maxLng;

  return {
    valid: true,
    inOperatingRegion: inRegion,
    message: inRegion
      ? 'Location is within supported Central India / MP operating region.'
      : 'Notice: Location is outside standard Madhya Pradesh operating region.',
  };
}

/**
 * Searches locations using OpenStreetMap Nominatim with city/state bias.
 *
 * @param {string} query
 * @param {AbortSignal} [signal] Optional abort signal for cancelling stale requests
 * @returns {Promise<Array<Object>>}
 */
export async function searchPlaces(query, signal = null) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  const searchQuery = cleanQuery.toLowerCase().includes('indore')
    ? cleanQuery
    : `${cleanQuery}, Indore, Madhya Pradesh`;

  try {
    const params = new URLSearchParams({
      q: searchQuery,
      format: 'json',
      addressdetails: '1',
      limit: '7',
      countrycodes: 'in',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding search service returned status ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const addr = item.address || {};
      const houseNumber = addr.house_number || '';
      const street = addr.road || addr.street || addr.pedestrian || '';
      const locality = addr.suburb || addr.neighbourhood || addr.residential || '';
      const sublocality = addr.quarter || addr.city_district || addr.commercial || '';
      const city = addr.city || addr.town || addr.village || 'Indore';
      const district = addr.county || addr.state_district || 'Indore';
      const state = addr.state || 'Madhya Pradesh';
      const pincode = addr.postcode || '';
      const country = addr.country || 'India';

      return {
        id: String(item.place_id || item.osm_id || Math.random()),
        name: item.name || locality || street || item.display_name.split(',')[0],
        formattedAddress: item.display_name,
        houseNumber,
        street,
        locality,
        sublocality,
        city,
        district,
        state,
        pincode,
        country,
        coordinates: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        },
        provider: 'nominatim',
      };
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return []; // Request was aborted due to newer keystroke
    }
    console.warn('[mapProvider] Search error:', err.message);
    throw err;
  }
}

/**
 * Reverse geocodes a coordinate pair (lat, lng) into structured address fields.
 *
 * Never silently fabricates fake address information if reverse geocoding fails.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {AbortSignal} [signal] Optional abort signal
 * @returns {Promise<Object>}
 */
export async function reverseGeocode(lat, lng, signal = null) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    throw new Error('Valid numeric latitude and longitude coordinates are required.');
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      addressdetails: '1',
      zoom: '18',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error || 'Address could not be resolved for these coordinates.');
    }

    const addr = data.address || {};
    const houseNumber = addr.house_number || '';
    const street = addr.road || addr.street || addr.pedestrian || '';
    const locality = addr.suburb || addr.neighbourhood || addr.residential || '';
    const sublocality = addr.quarter || addr.city_district || addr.commercial || '';
    const city = addr.city || addr.town || addr.village || 'Indore';
    const district = addr.county || addr.state_district || 'Indore';
    const state = addr.state || 'Madhya Pradesh';
    const pincode = addr.postcode || '';
    const country = addr.country || 'India';

    return {
      success: true,
      formattedAddress: data.display_name || `${street}, ${locality}, ${city}`,
      houseNumber,
      street,
      locality,
      sublocality,
      city,
      district,
      state,
      pincode,
      country,
      coordinates: { lat, lng },
      placeId: String(data.place_id || ''),
      provider: 'nominatim',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return null;
    }
    console.warn('[mapProvider] Reverse geocoding error:', err.message);
    throw err;
  }
}

/**
 * Calculates estimated driving distance in kilometers using the Haversine formula
 * with a 1.35 urban road winding factor.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const crowDistance = R * c;
  return Math.round(crowDistance * 1.35 * 10) / 10;
}
