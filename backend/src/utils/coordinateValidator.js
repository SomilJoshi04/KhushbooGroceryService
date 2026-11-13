/**
 * Server-Side Geographic Coordinate Validator & Sanitizer.
 *
 * Implements:
 * - Authoritative coordinate validation for order creation, store dispatch settings, and delivery pricing.
 * - Strict Earth boundary checks (-90 <= lat <= 90, -180 <= lng <= 180).
 * - Comprehensive type safety: rejects strings, null, undefined, NaN, Infinity, arrays.
 * - Zero silent conversions to 0,0 or fallback coordinates.
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

  const rawLat = coords.lat !== undefined ? coords.lat : coords.latitude;
  const rawLng = coords.lng !== undefined ? coords.lng : coords.longitude;

  if (typeof rawLat !== 'number' || typeof rawLng !== 'number') {
    return { valid: false, error: 'Latitude and Longitude must be strict numbers.' };
  }

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
    return { valid: false, error: 'Coordinates must be finite numbers (NaN, Infinity rejected).' };
  }

  if (rawLat < -90 || rawLat > 90) {
    return { valid: false, error: `Latitude ${rawLat} is outside valid Earth range (-90 to +90 degrees).` };
  }

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

