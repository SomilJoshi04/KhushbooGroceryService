/**
 * Distance-Based Delivery Pricing Engine & Validator.
 *
 * Implements:
 * - Robust coordinate validation (lat: -90 to +90, lng: -180 to +180, finite numeric values).
 * - Haversine distance calculation with 1.35x urban road winding factor (approximation).
 *   NOTE: This calculates geographic distance multiplied by an empirical 1.35 road factor
 *   representing urban street curvature in Indore. It intentionally does NOT introduce
 *   turn-by-turn routing or Google Routes API dependencies, keeping calculations fast,
 *   offline-capable, zero-cost, and backend-authoritative.
 * - Strict distance rule validation (contiguous, non-overlapping, non-empty, within max radius).
 * - Consistent half-open interval matching [fromKm, toKm) with inclusive upper bound on final rule.
 * - Safe monetary handling in integer paise.
 *
 * @module utils/distancePricing
 */

import { validateCoordinates, isValidLatLng } from './coordinateValidator.js';

export { validateCoordinates, isValidLatLng };

/**
 * Validates whether latitude and longitude are valid finite numbers within bounds.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function isValidCoordinate(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Calculates great-circle distance between two geographic points using the Haversine formula,
 * scaled by an urban road winding factor (1.35x) and rounded safely to 2 decimal places.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @param {number} [roadFactor=1.35]
 * @returns {number|null} Estimated road distance in kilometers, or null if coordinates invalid
 */
export function calculateRoadDistanceKm(lat1, lon1, lat2, lon2, roadFactor = 1.35) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  // Exact same point
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Earth radius in km
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineKm = R * c;
  const estimatedRoadKm = straightLineKm * roadFactor;

  // Round safely to 2 decimal places to avoid floating-point jitter
  return Math.round(estimatedRoadKm * 100) / 100;
}

/**
 * Strictly validates an array of distance pricing rules against the configured maximum radius.
 *
 * Validation Invariants:
 * 1. Configuration must contain at least one rule when enabled.
 * 2. Rules must start at exactly 0 km.
 * 3. Each rule must have fromKm >= 0, toKm > fromKm, and feePaise >= 0.
 * 4. Ranges must be strictly contiguous without gaps and without overlaps:
 *    rule[i].fromKm must strictly equal rule[i-1].toKm.
 * 5. No rule can exceed the maxDeliveryDistanceKm.
 * 6. The final rule must cover up to maxDeliveryDistanceKm.
 *
 * @param {Array<{fromKm: number, toKm: number, feePaise: number, useStandardFee?: boolean}>} rules
 * @param {number} maxDeliveryDistanceKm
 * @param {number} standardFeePaise
 * @returns {{ valid: boolean, errors: string[], normalizedRules: Array }}
 */
export function validateDistanceRules(rules, maxDeliveryDistanceKm, standardFeePaise = 2500) {
  const errors = [];

  if (!Number.isFinite(maxDeliveryDistanceKm) || maxDeliveryDistanceKm <= 0) {
    errors.push('Maximum delivery radius must be a positive number greater than 0.');
    return { valid: false, errors, normalizedRules: [] };
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    errors.push('At least one distance rule is required when distance-based pricing is enabled.');
    return { valid: false, errors, normalizedRules: [] };
  }

  const normalizedRules = [];

  for (let i = 0; i < rules.length; i++) {
    const raw = rules[i];
    if (!raw || typeof raw !== 'object') {
      errors.push(`Rule #${i + 1} is malformed.`);
      continue;
    }

    const fromKm = Number(raw.fromKm);
    const toKm = Number(raw.toKm);
    const useStandardFee = Boolean(raw.useStandardFee);
    const feePaise = useStandardFee
      ? Number(standardFeePaise)
      : Math.round(Number(raw.feePaise !== undefined ? raw.feePaise : (raw.feeRupees ? raw.feeRupees * 100 : 0)));

    if (!Number.isFinite(fromKm) || fromKm < 0) {
      errors.push(`Rule #${i + 1}: "From (km)" must be a non-negative finite number.`);
    }

    if (!Number.isFinite(toKm) || toKm <= 0) {
      errors.push(`Rule #${i + 1}: "To (km)" must be a positive finite number.`);
    } else if (Number.isFinite(fromKm) && toKm <= fromKm) {
      errors.push(`Rule #${i + 1}: "To (km)" (${toKm}) must be strictly greater than "From (km)" (${fromKm}).`);
    }

    if (!Number.isFinite(feePaise) || feePaise < 0) {
      errors.push(`Rule #${i + 1}: Delivery fee cannot be negative.`);
    }

    if (Number.isFinite(toKm) && toKm > maxDeliveryDistanceKm) {
      errors.push(
        `Rule #${i + 1}: "To (km)" (${toKm} km) cannot exceed the store's maximum delivery radius (${maxDeliveryDistanceKm} km).`
      );
    }

    normalizedRules.push({
      fromKm: Math.round(fromKm * 100) / 100,
      toKm: Math.round(toKm * 100) / 100,
      feePaise,
      useStandardFee,
      label: raw.label?.trim() || `${fromKm}–${toKm} km`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors, normalizedRules: [] };
  }

  // Sort rules by fromKm ascending
  normalizedRules.sort((a, b) => a.fromKm - b.fromKm);

  // Invariant 1: First rule must start at 0
  if (normalizedRules[0].fromKm !== 0) {
    errors.push(`First distance slab must start at 0 km. Found start: ${normalizedRules[0].fromKm} km.`);
  }

  // Invariant 2: Contiguity and Non-overlapping check
  for (let i = 1; i < normalizedRules.length; i++) {
    const prev = normalizedRules[i - 1];
    const curr = normalizedRules[i];

    if (curr.fromKm < prev.toKm) {
      errors.push(
        `Overlapping distance slabs detected: Rule #${i} ends at ${prev.toKm} km, but Rule #${i + 1} begins at ${curr.fromKm} km.`
      );
    } else if (curr.fromKm > prev.toKm) {
      errors.push(
        `Coverage gap detected: Gap between ${prev.toKm} km and ${curr.fromKm} km. All distance slabs must be continuous.`
      );
    }
  }

  // Invariant 3: Last rule must reach maxDeliveryDistanceKm
  const lastRule = normalizedRules[normalizedRules.length - 1];
  if (lastRule.toKm !== Math.round(maxDeliveryDistanceKm * 100) / 100) {
    errors.push(
      `Final distance slab must cover up to the maximum delivery radius (${maxDeliveryDistanceKm} km). Current final slab ends at ${lastRule.toKm} km.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedRules,
  };
}

/**
 * Resolves the applicable delivery fee for a given distance according to configured rules.
 *
 * Interval Logic:
 * - Intermediate ranges are half-open: [fromKm, toKm)
 *   e.g. 0 <= distance < 5 -> Rule 1
 *        5 <= distance < 10 -> Rule 2
 * - The final range includes the upper boundary: [fromKm, toKm]
 *   e.g. 10 <= distance <= 15 -> Rule 3
 * - Distance > maxRadius -> Not deliverable.
 *
 * @param {Array<{fromKm: number, toKm: number, feePaise: number, useStandardFee?: boolean, label?: string}>} rules
 * @param {number} distanceKm
 * @param {number} maxRadiusKm
 * @param {number} standardFeePaise
 * @returns {{
 *   isDeliverable: boolean,
 *   deliveryFeePaise: number,
 *   appliedRule: Object|null,
 *   reason?: string
 * }}
 */
export function resolveDistanceDeliveryFee(rules, distanceKm, maxRadiusKm, standardFeePaise = 2500) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return {
      isDeliverable: false,
      deliveryFeePaise: 0,
      appliedRule: null,
      reason: 'Invalid delivery distance.',
    };
  }

  const normalizedDistance = Math.round(distanceKm * 100) / 100;
  const normalizedMax = Math.round(maxRadiusKm * 100) / 100;

  if (normalizedDistance > normalizedMax) {
    return {
      isDeliverable: false,
      deliveryFeePaise: 0,
      appliedRule: null,
      reason: `Delivery distance (${normalizedDistance} km) exceeds maximum serviceable radius (${normalizedMax} km).`,
    };
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    return {
      isDeliverable: true,
      deliveryFeePaise: standardFeePaise,
      appliedRule: null,
      reason: 'Fallback to standard delivery fee.',
    };
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const isLast = i === rules.length - 1;
    const from = rule.fromKm;
    const to = rule.toKm;

    if (isLast) {
      // Final interval is closed: [from, to]
      if (normalizedDistance >= from && normalizedDistance <= to) {
        const feePaise = rule.useStandardFee ? standardFeePaise : rule.feePaise;
        return {
          isDeliverable: true,
          deliveryFeePaise: feePaise,
          appliedRule: {
            fromKm: rule.fromKm,
            toKm: rule.toKm,
            feePaise,
            useStandardFee: rule.useStandardFee,
            label: rule.label || `${rule.fromKm}–${rule.toKm} km`,
          },
        };
      }
    } else {
      // Intermediate intervals are half-open: [from, to)
      if (normalizedDistance >= from && normalizedDistance < to) {
        const feePaise = rule.useStandardFee ? standardFeePaise : rule.feePaise;
        return {
          isDeliverable: true,
          deliveryFeePaise: feePaise,
          appliedRule: {
            fromKm: rule.fromKm,
            toKm: rule.toKm,
            feePaise,
            useStandardFee: rule.useStandardFee,
            label: rule.label || `${rule.fromKm}–${rule.toKm} km`,
          },
        };
      }
    }
  }

  // Edge case: if distance is within maxRadiusKm but falls outside defined slabs
  return {
    isDeliverable: false,
    deliveryFeePaise: 0,
    appliedRule: null,
    reason: `Distance (${normalizedDistance} km) does not match any configured delivery pricing slab.`,
  };
}

