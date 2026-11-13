/**
 * Reusable Geographic Coordinate Validator & LocalStorage Parser.
 *
 * Implements:
 * - Strict Earth coordinate boundary checks (-90 <= lat <= 90, -180 <= lng <= 180).
 * - Comprehensive type safety: rejects null, undefined, strings, NaN, Infinity, arrays, malformed objects.
 * - Normalized coordinate structure generator { lat: number, lng: number }.
 * - Zero silent conversions to 0,0 or fallback locations.
 * - Safe parser for 'khushboo_customer_location' localStorage cache with corruption resistance.
 *
 * @module utils/coordinateValidator
 */

/**
 * Validates a coordinate object or lat/lng values strictly.
 *
 * @param {any} coords - Object with { lat, lng } or { latitude, longitude }
 * @returns {{ valid: boolean, error?: string, normalized?: { lat: number, lng: number } }}
 */
export function validateCoordinates(coords) {
  if (coords === null || coords === undefined) {
    return { valid: false, error: 'Coordinates cannot be null or undefined.' };
  }

  if (typeof coords !== 'object' || Array.isArray(coords)) {
    return { valid: false, error: 'Coordinates must be an object with numeric lat and lng properties.' };
  }

  // Extract candidate lat & lng properties
  const rawLat = coords.lat !== undefined ? coords.lat : coords.latitude;
  const rawLng = coords.lng !== undefined ? coords.lng : coords.longitude;

  // Strict numeric type check — no string auto-coercion
  if (typeof rawLat !== 'number' || typeof rawLng !== 'number') {
    return { valid: false, error: 'Latitude and Longitude must be strict numbers.' };
  }

  // Check for NaN and Infinities
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
    return { valid: false, error: 'Coordinates must be finite numbers (NaN, Infinity rejected).' };
  }

  // Earth geographic latitude boundaries
  if (rawLat < -90 || rawLat > 90) {
    return { valid: false, error: `Latitude ${rawLat} is outside valid Earth range (-90 to +90 degrees).` };
  }

  // Earth geographic longitude boundaries
  if (rawLng < -180 || rawLng > 180) {
    return { valid: false, error: `Longitude ${rawLng} is outside valid Earth range (-180 to +180 degrees).` };
  }

  return {
    valid: true,
    normalized: {
      lat: Math.round(rawLat * 1000000) / 1000000,
      lng: Math.round(rawLng * 1000000) / 1000000,
    },
  };
}

/**
 * Quick boolean check for coordinates.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Safely parses and validates the customer location stored in localStorage.
 *
 * Defends against:
 * - Malformed JSON strings.
 * - Missing or invalid coordinates.
 * - Incomplete or tampered address structures.
 * - Legacy data shapes.
 *
 * NEVER silently defaults to 0,0 or fallback coordinates.
 *
 * @param {string|null} storedString - Raw string from localStorage.getItem('khushboo_customer_location')
 * @returns {Object|null} Validated customer location object, or null if invalid/corrupt.
 */
export function safeParseStoredLocation(storedString) {
  if (!storedString || typeof storedString !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(storedString.trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    // Coordinates are mandatory for a valid delivery location
    if (!parsed.coordinates) {
      return null;
    }

    const coordCheck = validateCoordinates(parsed.coordinates);
    if (!coordCheck.valid || !coordCheck.normalized) {
      return null;
    }

    // Sanitize string fields without fabricating fake Indore if absent
    const shortName = typeof parsed.shortName === 'string' ? parsed.shortName.trim().slice(0, 100) : '';
    const formattedAddress = typeof parsed.formattedAddress === 'string' ? parsed.formattedAddress.trim().slice(0, 300) : '';
    const locality = typeof parsed.locality === 'string' ? parsed.locality.trim().slice(0, 100) : '';
    const city = typeof parsed.city === 'string' ? parsed.city.trim().slice(0, 100) : '';
    const pincode = typeof parsed.pincode === 'string' ? parsed.pincode.trim().slice(0, 10) : '';

    return {
      shortName: shortName || formattedAddress.split(',')[0]?.trim() || 'Selected Location',
      formattedAddress,
      locality,
      city,
      pincode,
      coordinates: coordCheck.normalized,
      addressId: typeof parsed.addressId === 'string' ? parsed.addressId : undefined,
    };
  } catch {
    // Malformed JSON — return null safely
    return null;
  }
}

