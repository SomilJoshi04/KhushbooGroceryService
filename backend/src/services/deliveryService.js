/**
 * Delivery Serviceability & Dynamic Zone Pricing Engine.
 *
 * Implements:
 * - Dynamic DeliveryZone schema querying with deterministic overlap resolution.
 * - Automatic seeding of default Indore zones if DB is empty.
 * - Configurable store dispatch center from StoreSetting.
 * - Pause detection with custom administrative reasons.
 * - Distance calculation via Haversine formula + urban road curvature factor (1.35x).
 * - Per-zone delivery pricing (minimum order amount, base fee, extra km tiers, free delivery threshold).
 * - Snapshot generation for order persistence.
 *
 * @module services/deliveryService
 */

import { env } from '../config/env.js';
import { DeliveryZone } from '../models/DeliveryZone.js';
import { StoreSetting } from '../models/StoreSetting.js';

// Legacy approved Indore PIN codes export preserved for backward-compatibility
export const APPROVED_INDORE_PINCODES = new Set([
  '452001', '452002', '452003', '452004', '452005', '452006',
  '452007', '452008', '452009', '452010', '452011', '452012',
  '452013', '452014', '452015', '452016', '452018', '452020',
]);

// Verified default store dispatch center (Geeta Bhawan / MG Road, Indore)
export const STORE_LOCATION = {
  address: 'Khushboo Food Service Hub, Geeta Bhawan, MG Road, Indore, MP 452001',
  lat: env.STORE_LAT || 22.7196,
  lng: env.STORE_LNG || 75.8577,
  city: env.STORE_CITY || 'Indore',
  pincode: env.STORE_PINCODE || '452001',
};

// Distance pricing slabs fallback
export const DELIVERY_SLABS = [
  { minKm: 0, maxKm: 3, feePaise: 2500, label: '0–3 km (Local Colony)' },
  { minKm: 3, maxKm: 6, feePaise: 4000, label: '3–6 km (Standard Area)' },
  { minKm: 6, maxKm: 10, feePaise: 6000, label: '6–10 km (Extended City)' },
  { minKm: 10, maxKm: 15, feePaise: 9000, label: '10–15 km (Outer Bypass)' },
];

/**
 * Calculates great-circle distance between two coordinates using the Haversine formula,
 * adjusted with a 1.35 urban road winding factor for accurate road distance.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Estimated road distance in kilometers
 */
export function calculateEstimatedRoadDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  ) {
    return 4.0; // fallback standard city distance
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineDistance = R * c;

  // Indian urban road factor: actual driving route is typically ~30-35% longer than straight line
  const roadFactor = 1.35;
  const estimatedRoadKm = straightLineDistance * roadFactor;

  return Math.round(estimatedRoadKm * 10) / 10;
}

/**
 * Ensures initial default zones exist in MongoDB.
 * Auto-seeds Central Indore, Vijay Nagar/Palasia, and Rau/Bypass zones.
 */
export async function ensureDefaultZonesExist() {
  try {
    const count = await DeliveryZone.countDocuments({ isDeleted: false });
    if (count > 0) return;

    const defaultZones = [
      {
        name: 'Indore Central & Heritage',
        code: 'IND-CENTRAL',
        description: 'MG Road, Rajwada, Chhappan Dukan, Geeta Bhawan, Navlakha, and Old Indore',
        city: 'Indore',
        state: 'Madhya Pradesh',
        supportedPincodes: ['452001', '452002', '452003', '452004', '452005', '452007'],
        center: { lat: 22.7196, lng: 75.8577 },
        radiusKm: 6.0,
        dispatchLocation: {
          name: 'Indore Central Dispatch Hub',
          address: 'MG Road & Geeta Bhawan, Indore, MP 452001',
          lat: 22.7196,
          lng: 75.8577,
        },
        minOrderAmountPaise: 15000, // ₹150
        freeDeliveryThresholdPaise: 49900, // ₹499
        deliveryFeeBasePaise: 2500, // ₹25
        distanceTierPaisePerKm: 500, // ₹5/km
        maxDeliveryDistanceKm: 12,
        estimatedDeliveryWindow: '60 - 90 Minutes',
        isActive: true,
        isPaused: false,
        priority: 10,
      },
      {
        name: 'Vijay Nagar & Palasia Corridor',
        code: 'IND-VIJAYNAGAR',
        description: 'Vijay Nagar, Old/New Palasia, Scheme 54, Scheme 78, MR-10, Mahalaxmi Nagar',
        city: 'Indore',
        state: 'Madhya Pradesh',
        supportedPincodes: ['452008', '452009', '452010', '452011', '452018'],
        center: { lat: 22.7533, lng: 75.8937 },
        radiusKm: 7.5,
        dispatchLocation: {
          name: 'Indore Central Dispatch Hub',
          address: 'MG Road & Geeta Bhawan, Indore, MP 452001',
          lat: 22.7196,
          lng: 75.8577,
        },
        minOrderAmountPaise: 15000,
        freeDeliveryThresholdPaise: 49900,
        deliveryFeeBasePaise: 3500, // ₹35
        distanceTierPaisePerKm: 500,
        maxDeliveryDistanceKm: 15,
        estimatedDeliveryWindow: '75 - 100 Minutes',
        isActive: true,
        isPaused: false,
        priority: 10,
      },
      {
        name: 'Rau, Bypass & Super Corridor',
        code: 'IND-RAUBYPASS',
        description: 'Silicon City, Rau, AB Road Bypass, Tejaji Nagar, Super Corridor and Cat Colony',
        city: 'Indore',
        state: 'Madhya Pradesh',
        supportedPincodes: ['452012', '452013', '452014', '452015', '452016', '452020'],
        center: { lat: 22.6450, lng: 75.8150 },
        radiusKm: 10.0,
        dispatchLocation: {
          name: 'Indore Central Dispatch Hub',
          address: 'MG Road & Geeta Bhawan, Indore, MP 452001',
          lat: 22.7196,
          lng: 75.8577,
        },
        minOrderAmountPaise: 20000, // ₹200
        freeDeliveryThresholdPaise: 59900, // ₹599
        deliveryFeeBasePaise: 4500, // ₹45
        distanceTierPaisePerKm: 600,
        maxDeliveryDistanceKm: 18,
        estimatedDeliveryWindow: '90 - 120 Minutes',
        isActive: true,
        isPaused: false,
        priority: 5,
      },
    ];

    await DeliveryZone.insertMany(defaultZones);
    console.log('[DeliveryZone] Auto-seeded 3 default delivery zones for Indore.');
  } catch (err) {
    console.error('[DeliveryZone] Seed check error:', err.message);
  }
}

/**
 * Retrieves the currently active store dispatch center coordinates.
 * Reads from StoreSetting collection, with fallback to environment variables.
 */
export async function getEffectiveStoreLocation() {
  try {
    const setting = await StoreSetting.findOne().lean();
    if (setting && setting.dispatchCoordinates?.lat && setting.dispatchCoordinates?.lng) {
      return {
        name: setting.storeName || 'Khushboo Food Service',
        address: setting.address || STORE_LOCATION.address,
        lat: setting.dispatchCoordinates.lat,
        lng: setting.dispatchCoordinates.lng,
        city: setting.serviceCity || 'Indore',
        pincode: setting.servicePincode || '452001',
      };
    }
  } catch {
    // Return fallback on DB query failure
  }
  return STORE_LOCATION;
}

/**
 * Dynamically resolves effective minimum order amount in integer paise.
 * Prioritizes zone-specific settings, then global StoreSetting from database,
 * and finally falls back to environment defaults.
 */
export async function getEffectiveMinOrderAmountPaise(zone = null) {
  if (zone?.minOrderAmountPaise !== undefined && zone?.minOrderAmountPaise !== null) {
    return Number(zone.minOrderAmountPaise);
  }
  try {
    const setting = await StoreSetting.findOne().lean();
    if (setting?.minOrderAmountPaise !== undefined && setting?.minOrderAmountPaise !== null) {
      return Number(setting.minOrderAmountPaise);
    }
  } catch {
    // Return fallback on DB query failure
  }
  return env.MIN_ORDER_AMOUNT_PAISE || 1000;
}

/**
 * Dynamically resolves effective free delivery threshold in integer paise.
 * Prioritizes zone-specific settings, then global StoreSetting from database,
 * and finally falls back to environment defaults.
 */
export async function getEffectiveFreeDeliveryThresholdPaise(zone = null) {
  if (zone?.freeDeliveryThresholdPaise !== undefined && zone?.freeDeliveryThresholdPaise !== null) {
    return Number(zone.freeDeliveryThresholdPaise);
  }
  try {
    const setting = await StoreSetting.findOne().lean();
    if (setting?.freeDeliveryThresholdPaise !== undefined && setting?.freeDeliveryThresholdPaise !== null) {
      return Number(setting.freeDeliveryThresholdPaise);
    }
  } catch {
    // Return fallback on DB query failure
  }
  return env.FREE_DELIVERY_THRESHOLD_PAISE || 49900;
}

/**
 * Finds the applicable delivery zone using deterministic scoring.
 *
 * Deterministic Overlap Resolution Rules:
 * 1. An address is evaluated against all active, non-deleted zones.
 * 2. Match criteria:
 *    - Both PIN code match and coordinates within zone radius: Score = 100 + zone.priority
 *    - Coordinates within zone radius: Score = 70 + zone.priority
 *    - PIN code match: Score = 50 + zone.priority
 * 3. Highest score zone is selected.
 * 4. In case of a tie, the zone with the closer center coordinate wins.
 *
 * @param {Object} params
 * @param {string} params.pincode
 * @param {string} [params.city]
 * @param {{lat?: number, lng?: number}} [params.coordinates]
 * @returns {Promise<DeliveryZone|null>}
 */
export async function findMatchingZone({ pincode, city = 'Indore', coordinates }) {
  await ensureDefaultZonesExist();

  const cleanPincode = String(pincode || '').trim();
  const hasCoords = coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number';

  const candidateZones = await DeliveryZone.find({
    isActive: true,
    isDeleted: false,
  }).lean();

  if (!candidateZones.length) return null;

  let bestZone = null;
  let bestScore = -1;
  let bestDistanceToCenter = Infinity;

  for (const zone of candidateZones) {
    const isPincodeMatch = zone.supportedPincodes.includes(cleanPincode);
    let isRadiusMatch = false;
    let distToCenter = Infinity;

    if (hasCoords && zone.center?.lat && zone.center?.lng) {
      distToCenter = calculateEstimatedRoadDistanceKm(
        zone.center.lat,
        zone.center.lng,
        coordinates.lat,
        coordinates.lng
      );
      isRadiusMatch = distToCenter <= (zone.radiusKm || 5.0);
    }

    let score = 0;
    if (isPincodeMatch && isRadiusMatch) {
      score = 100 + (zone.priority || 0);
    } else if (isRadiusMatch) {
      score = 70 + (zone.priority || 0);
    } else if (isPincodeMatch) {
      score = 50 + (zone.priority || 0);
    }

    if (score > 0) {
      if (score > bestScore || (score === bestScore && distToCenter < bestDistanceToCenter)) {
        bestScore = score;
        bestDistanceToCenter = distToCenter;
        bestZone = zone;
      }
    }
  }

  return bestZone;
}

/**
 * Validates delivery serviceability and recalculates the authoritative delivery fee.
 *
 * Never trusts zone ID, distance, or delivery fee submitted by the client.
 *
 * @param {Object} params
 * @param {string} params.pincode - 6-digit Indian PIN code
 * @param {string} [params.city] - City name
 * @param {{lat?: number, lng?: number}} [params.coordinates] - Coordinates
 * @param {number} params.subtotalPaise - Order items subtotal in integer paise
 * @returns {Promise<{
 *   isServiceable: boolean,
 *   isPaused?: boolean,
 *   pauseReason?: string,
 *   distanceKm: number,
 *   deliveryFeePaise: number,
 *   standardFeePaise: number,
 *   isFreeDelivery: boolean,
 *   minOrderAmountPaise: number,
 *   estimatedDeliveryWindow: string,
 *   zone?: Object,
 *   reason?: string,
 *   pricingSnapshot: Object
 * }>}
 */
export async function calculateDeliveryPricing({
  pincode,
  city = 'Indore',
  coordinates,
  subtotalPaise = 0,
}) {
  const cleanPincode = String(pincode || '').trim();

  // 1. Find matching zone using deterministic overlap engine
  const zone = await findMatchingZone({ pincode: cleanPincode, city, coordinates });

  if (!zone) {
    const minOrderAmountPaise = await getEffectiveMinOrderAmountPaise();
    const freeDeliveryThresholdPaise = await getEffectiveFreeDeliveryThresholdPaise();
    return {
      isServiceable: false,
      distanceKm: 0,
      deliveryFeePaise: 0,
      standardFeePaise: 0,
      isFreeDelivery: false,
      minOrderAmountPaise,
      freeDeliveryThresholdPaise,
      estimatedDeliveryWindow: 'Unavailable',
      reason: `Pincode ${cleanPincode} is outside our supported delivery zones. Currently serving Indore zones.`,
      pricingSnapshot: { error: 'UNSERVICEABLE_AREA', pincode: cleanPincode },
    };
  }

  // 2. Check if zone is temporarily paused
  if (zone.isPaused) {
    const minOrderAmountPaise = await getEffectiveMinOrderAmountPaise(zone);
    const freeDeliveryThresholdPaise = await getEffectiveFreeDeliveryThresholdPaise(zone);
    return {
      isServiceable: false,
      isPaused: true,
      pauseReason: zone.pauseReason || 'Delivery temporarily suspended in this zone.',
      distanceKm: 0,
      deliveryFeePaise: 0,
      standardFeePaise: 0,
      isFreeDelivery: false,
      minOrderAmountPaise,
      freeDeliveryThresholdPaise,
      estimatedDeliveryWindow: 'Temporarily Paused',
      zone: {
        id: zone._id,
        code: zone.code,
        name: zone.name,
        city: zone.city,
        minOrderAmountPaise,
        freeDeliveryThresholdPaise,
        estimatedDeliveryWindow: zone.estimatedDeliveryWindow,
      },
      reason: `Service in ${zone.name} is temporarily suspended: ${zone.pauseReason || 'Heavy demand / local maintenance'}.`,
      pricingSnapshot: {
        error: 'ZONE_TEMPORARILY_PAUSED',
        zoneId: zone._id,
        pauseReason: zone.pauseReason,
      },
    };
  }

  // 3. Determine authoritative dispatch center and road distance
  const storeLocation = await getEffectiveStoreLocation();
  let distanceKm = 3.5; // fallback default

  if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
    distanceKm = calculateEstimatedRoadDistanceKm(
      storeLocation.lat,
      storeLocation.lng,
      coordinates.lat,
      coordinates.lng
    );
  } else if (zone.center?.lat && zone.center?.lng) {
    distanceKm = calculateEstimatedRoadDistanceKm(
      storeLocation.lat,
      storeLocation.lng,
      zone.center.lat,
      zone.center.lng
    );
  }

  // 4. Maximum Delivery Distance check
  const maxDistance = zone.maxDeliveryDistanceKm || env.MAX_DELIVERY_DISTANCE_KM;
  if (distanceKm > maxDistance) {
    const minOrderAmountPaise = await getEffectiveMinOrderAmountPaise(zone);
    const freeDeliveryThresholdPaise = await getEffectiveFreeDeliveryThresholdPaise(zone);
    return {
      isServiceable: false,
      distanceKm,
      deliveryFeePaise: 0,
      standardFeePaise: 0,
      isFreeDelivery: false,
      minOrderAmountPaise,
      freeDeliveryThresholdPaise,
      estimatedDeliveryWindow: zone.estimatedDeliveryWindow,
      zone: {
        id: zone._id,
        code: zone.code,
        name: zone.name,
        city: zone.city,
        minOrderAmountPaise,
        freeDeliveryThresholdPaise,
        estimatedDeliveryWindow: zone.estimatedDeliveryWindow,
      },
      reason: `Distance (${distanceKm} km) exceeds maximum service limit (${maxDistance} km) for ${zone.name}.`,
      pricingSnapshot: { error: 'DISTANCE_EXCEEDED', distanceKm, maxDistance },
    };
  }

  // 5. Zone Pricing Calculations
  const freeThreshold = await getEffectiveFreeDeliveryThresholdPaise(zone);
  const isFreeDelivery = subtotalPaise >= freeThreshold;

  const baseFee = zone.deliveryFeeBasePaise ?? env.DELIVERY_FEE_BASE_PAISE;
  const extraKmTier = zone.distanceTierPaisePerKm ?? 500;
  // If distance exceeds 3 km, apply extra per-km fee
  const extraKm = Math.max(0, Math.ceil(distanceKm - 3));
  const standardFeePaise = baseFee + (extraKm * extraKmTier);
  const deliveryFeePaise = isFreeDelivery ? 0 : standardFeePaise;

  const minOrderAmount = await getEffectiveMinOrderAmountPaise(zone);

  const pricingSnapshot = {
    zoneId: zone._id,
    zoneCode: zone.code,
    zoneName: zone.name,
    storeLocation,
    distanceKm,
    baseFeePaise: baseFee,
    extraKm,
    extraKmTierPaise: extraKmTier,
    standardFeePaise,
    deliveryFeePaise,
    isFreeDelivery,
    thresholdPaise: freeThreshold,
    minOrderAmountPaise: minOrderAmount,
    estimatedDeliveryWindow: zone.estimatedDeliveryWindow,
    calculatedAt: new Date().toISOString(),
  };

  return {
    isServiceable: true,
    isPaused: false,
    distanceKm,
    deliveryFeePaise,
    standardFeePaise,
    isFreeDelivery,
    minOrderAmountPaise: minOrderAmount,
    freeDeliveryThresholdPaise: freeThreshold,
    estimatedDeliveryWindow: zone.estimatedDeliveryWindow,
    zone: {
      id: zone._id,
      code: zone.code,
      name: zone.name,
      city: zone.city,
      minOrderAmountPaise: minOrderAmount,
      freeDeliveryThresholdPaise: freeThreshold,
      estimatedDeliveryWindow: zone.estimatedDeliveryWindow,
    },
    pricingSnapshot,
  };
}
