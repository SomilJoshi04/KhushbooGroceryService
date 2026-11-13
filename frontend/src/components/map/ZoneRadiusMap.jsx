/**
 * Interactive Zone Radius Map Component with Multi-Provider Support (Google Maps Platform & Leaflet).
 *
 * Implements:
 * - Dynamic provider rendering: Google Maps JS SDK or Leaflet OSM fallback.
 * - Draggable zone center marker and interactive map-click positioning.
 * - Dynamic coverage circle synchronized with radiusKm (validated: positive, finite, <= 100 km).
 * - Debounced search places bar (350ms) with request cancellation (AbortController).
 * - Reverse-geocode race-condition protection via sequence counter.
 * - Operating region boundary detection with visual indicators.
 * - Zero fabricated addresses when reverse geocode fails.
 *
 * @module components/map/ZoneRadiusMap
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Search, Loader2, MapPin, AlertCircle, CheckCircle2, Navigation } from 'lucide-react';
import {
  searchPlaces,
  reverseGeocode,
  isWithinOperatingRegion,
  getActiveProvider,
  loadGoogleMapsSDK,
  DEFAULT_MAP_CENTER,
} from '../../services/mapProvider.js';
import { validateCoordinates } from '../../utils/coordinateValidator.js';

export function ZoneRadiusMap({
  center = { lat: 22.7196, lng: 75.8577 },
  radiusKm = 5.0,
  onLocationResolved,
  onResolvingStateChange,
  interactive = true,
  height = '320px',
  showSearchBar = true,
}) {
  const containerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const leafletMarkerRef = useRef(null);
  const leafletCircleRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkerRef = useRef(null);
  const googleCircleRef = useRef(null);

  const reverseAbortRef = useRef(null);
  const searchAbortRef = useRef(null);
  const activeReverseSeqRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAddressSummary, setCurrentAddressSummary] = useState('');
  const [regionNotice, setRegionNotice] = useState('');

  // Validate center coordinates safely
  const coordCheck = validateCoordinates(center);
  const safeLat = coordCheck.valid && coordCheck.normalized ? coordCheck.normalized.lat : DEFAULT_MAP_CENTER.lat;
  const safeLng = coordCheck.valid && coordCheck.normalized ? coordCheck.normalized.lng : DEFAULT_MAP_CENTER.lng;

  // Validate radius safely (0.1 to 100 km)
  const numRadius = Number(radiusKm);
  const safeRadiusKm = Number.isFinite(numRadius) && numRadius > 0 && numRadius <= 100 ? numRadius : 5.0;
  const safeRadiusMeters = safeRadiusKm * 1000;

  // Notify parent of resolving state
  const notifyResolving = useCallback(
    (resolving) => {
      setIsResolving(resolving);
      if (onResolvingStateChange) onResolvingStateChange(resolving);
    },
    [onResolvingStateChange]
  );

  // Perform reverse geocoding with race condition sequencing
  const resolveCoordinates = useCallback(
    async (lat, lng) => {
      const currentSeq = ++activeReverseSeqRef.current;
      if (reverseAbortRef.current) {
        reverseAbortRef.current.abort();
      }
      reverseAbortRef.current = new AbortController();

      notifyResolving(true);
      setErrorMessage('');

      // Check operating region boundary
      const regionCheck = isWithinOperatingRegion(lat, lng);
      setRegionNotice(regionCheck.inOperatingRegion ? '' : regionCheck.message);

      try {
        const details = await reverseGeocode(lat, lng, reverseAbortRef.current.signal);
        // Ignore stale responses
        if (currentSeq !== activeReverseSeqRef.current || !details) return;

        setCurrentAddressSummary(details.formattedAddress || `${details.locality}, ${details.city}`);
        if (onLocationResolved) {
          onLocationResolved(details);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && currentSeq === activeReverseSeqRef.current) {
          const msg = err.message || 'Unable to resolve address for this location.';
          setErrorMessage(msg);
          if (onLocationResolved) {
            onLocationResolved({
              success: false,
              coordinates: { lat, lng },
              error: msg,
            });
          }
        }
      } finally {
        if (currentSeq === activeReverseSeqRef.current) {
          notifyResolving(false);
        }
      }
    },
    [notifyResolving, onLocationResolved]
  );

  // Reposition across active map provider
  const setMapCenterAndCircle = (lat, lng, radiusM) => {
    if (googleMapRef.current && googleMarkerRef.current && googleCircleRef.current) {
      const pos = { lat, lng };
      googleMapRef.current.setCenter(pos);
      googleMarkerRef.current.setPosition(pos);
      googleCircleRef.current.setCenter(pos);
      if (radiusM) googleCircleRef.current.setRadius(radiusM);
    } else if (leafletMapRef.current && leafletMarkerRef.current && leafletCircleRef.current) {
      leafletMapRef.current.setView([lat, lng], leafletMapRef.current.getZoom() || 13, { animate: true });
      leafletMarkerRef.current.setLatLng([lat, lng]);
      leafletCircleRef.current.setLatLng([lat, lng]);
      if (radiusM) leafletCircleRef.current.setRadius(radiusM);
    }
  };

  // Cleanup map instances
  const destroyCurrentMap = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      leafletMarkerRef.current = null;
      leafletCircleRef.current = null;
    }
    if (googleMarkerRef.current) googleMarkerRef.current.setMap(null);
    if (googleCircleRef.current) googleCircleRef.current.setMap(null);
    googleMapRef.current = null;
  };

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;
    let isCancelled = false;

    const timer = setTimeout(async () => {
      if (!containerRef.current || isCancelled) return;
      destroyCurrentMap();

      const provider = getActiveProvider();

      if (provider === 'google') {
        try {
          const maps = await loadGoogleMapsSDK();
          if (isCancelled || !containerRef.current) return;

          const map = new maps.Map(containerRef.current, {
            center: { lat: safeLat, lng: safeLng },
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: interactive ? 'greedy' : 'none',
          });

          const marker = new maps.Marker({
            position: { lat: safeLat, lng: safeLng },
            map,
            draggable: interactive,
            title: 'Zone Center Hub',
          });

          const circle = new maps.Circle({
            map,
            center: { lat: safeLat, lng: safeLng },
            radius: safeRadiusMeters,
            strokeColor: '#245C43',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#245C43',
            fillOpacity: 0.15,
          });

          if (interactive) {
            marker.addListener('dragend', () => {
              const pos = marker.getPosition();
              if (pos) {
                circle.setCenter(pos);
                resolveCoordinates(pos.lat(), pos.lng());
              }
            });

            map.addListener('click', (e) => {
              if (e.latLng) {
                marker.setPosition(e.latLng);
                circle.setCenter(e.latLng);
                resolveCoordinates(e.latLng.lat(), e.latLng.lng());
              }
            });
          }

          googleMapRef.current = map;
          googleMarkerRef.current = marker;
          googleCircleRef.current = circle;
          return;
        } catch (sdkErr) {
          console.warn('[ZoneRadiusMap] Google Maps failed to load, falling back to Leaflet:', sdkErr.message);
          // Fall through to Leaflet initialization
        }
      }

      // Leaflet Initialization
      if (isCancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [safeLat, safeLng],
        zoom: 12,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      const svgIcon = L.divIcon({
        html: `
          <div style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="#245C43">
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7.15 14.33 7.45 14.72a.75.75 0 0 0 1.1 0C12.85 22.33 20 13.25 20 8c0-4.42-3.58-8-8-8zm0 11.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>
            </svg>
          </div>
        `,
        className: 'khushboo-zone-pin',
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const marker = L.marker([safeLat, safeLng], {
        icon: svgIcon,
        draggable: interactive,
      }).addTo(map);

      const circle = L.circle([safeLat, safeLng], {
        radius: safeRadiusMeters,
        color: '#245C43',
        weight: 2,
        fillColor: '#DCE8DC',
        fillOpacity: 0.35,
      }).addTo(map);

      if (interactive) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          circle.setLatLng(pos);
          resolveCoordinates(pos.lat, pos.lng);
        });

        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          circle.setLatLng(e.latlng);
          resolveCoordinates(e.latlng.lat, e.latlng.lng);
        });
      }

      leafletMapRef.current = map;
      leafletMarkerRef.current = marker;
      leafletCircleRef.current = circle;
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (reverseAbortRef.current) reverseAbortRef.current.abort();
      if (searchAbortRef.current) searchAbortRef.current.abort();
      destroyCurrentMap();
    };
  }, []);

  // Update center and circle radius when props change
  useEffect(() => {
    setMapCenterAndCircle(safeLat, safeLng, safeRadiusMeters);
  }, [safeLat, safeLng, safeRadiusMeters]);

  // Debounced search autocomplete
  useEffect(() => {
    const clean = searchQuery.trim();
    if (!clean || clean.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      searchAbortRef.current = new AbortController();

      setIsSearching(true);
      try {
        const results = await searchPlaces(clean, searchAbortRef.current.signal);
        setSuggestions(results);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[ZoneRadiusMap] Search error:', err.message);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle suggestion click
  const handleSelectSuggestion = (place) => {
    if (!place?.coordinates) return;
    const { lat, lng } = place.coordinates;
    const check = validateCoordinates({ lat, lng });
    if (!check.valid || !check.normalized) return;

    setSearchQuery(place.name || place.formattedAddress);
    setSuggestions([]);

    setMapCenterAndCircle(check.normalized.lat, check.normalized.lng, safeRadiusMeters);
    resolveCoordinates(check.normalized.lat, check.normalized.lng);
  };

  return (
    <div className="space-y-2">
      {/* Search Input Bar */}
      {showSearchBar && interactive && (
        <div className="relative z-20">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, landmark, or street in Indore (e.g. Vijay Nagar, Palasia, Bhawarkua)..."
              className="w-full pl-9 pr-9 py-2 bg-surface border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-xs"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 w-4 h-4 text-brand animate-spin" />
            )}
          </div>

          {/* Search Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border-neutral rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-border-neutral animate-fadeIn">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full text-left px-3 py-2 hover:bg-surface-subtle transition flex items-start gap-2.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-main truncate">{item.name}</p>
                    <p className="text-[11px] text-text-muted truncate">{item.formattedAddress}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map Container */}
      <div className="relative rounded-xl border border-border-neutral overflow-hidden shadow-xs">
        <div ref={containerRef} style={{ height, width: '100%' }} />

        {/* Loading overlay */}
        {isResolving && (
          <div className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-xl bg-surface/90 backdrop-blur-xs border border-border-neutral shadow-sm flex items-center gap-2 text-[11px] font-semibold text-brand animate-fadeIn">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Resolving Location...</span>
          </div>
        )}

        {/* Interactive Helper Hint */}
        {interactive && (
          <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-lg bg-surface/90 backdrop-blur-2xs border border-border-neutral shadow-2xs text-[10px] text-text-muted flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-brand" />
            <span>Click map or drag marker to reposition zone center</span>
          </div>
        )}
      </div>

      {/* Region notice warning */}
      {regionNotice && (
        <div className="p-2.5 bg-status-warning/10 border border-status-warning/30 rounded-xl flex items-center gap-2 text-[11px] text-status-warning animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{regionNotice}</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-[11px] text-status-error animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Current Address Summary Bar */}
      {currentAddressSummary && !errorMessage && (
        <div className="p-2.5 bg-surface-subtle border border-border-neutral rounded-xl flex items-center gap-2 text-[11px] text-text-main shadow-2xs animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0" />
          <span className="text-text-muted">Selected:</span>
          <span className="font-semibold truncate flex-1">{currentAddressSummary}</span>
        </div>
      )}
    </div>
  );
}
