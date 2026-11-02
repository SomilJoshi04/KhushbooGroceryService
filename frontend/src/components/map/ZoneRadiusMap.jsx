/**
 * Interactive Zone Radius Map Component with Automatic Location Geocoding.
 *
 * Implements:
 * - Search bar with 350ms debouncing and suggestion dropdown.
 * - Draggable Leaflet pin and map click selection.
 * - Automatic reverse geocoding on drag/click/selection.
 * - Request cancellation (AbortController) to prevent stale geocoding responses.
 * - Coverage circle synchronized with radius slider.
 * - Loading indicator and visible error state (never fabricated values).
 * - Notifies parent component of location details and resolving status.
 *
 * @module components/map/ZoneRadiusMap
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Search, Loader2, MapPin, AlertCircle, CheckCircle2, Navigation } from 'lucide-react';
import { searchPlaces, reverseGeocode, isWithinOperatingRegion } from '../../services/mapProvider.js';

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
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const abortControllerRef = useRef(null);
  const searchAbortRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAddressSummary, setCurrentAddressSummary] = useState('');
  const [regionNotice, setRegionNotice] = useState('');

  // Notify parent of resolving state
  const notifyResolving = useCallback(
    (resolving) => {
      setIsResolving(resolving);
      if (onResolvingStateChange) onResolvingStateChange(resolving);
    },
    [onResolvingStateChange]
  );

  // Perform reverse geocoding with stale request cancellation
  const resolveCoordinates = useCallback(
    async (lat, lng) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      notifyResolving(true);
      setErrorMessage('');

      // Check operating region boundary
      const regionCheck = isWithinOperatingRegion(lat, lng);
      setRegionNotice(regionCheck.inOperatingRegion ? '' : regionCheck.message);

      try {
        const details = await reverseGeocode(lat, lng, abortControllerRef.current.signal);
        if (!details) return; // Aborted

        setCurrentAddressSummary(details.formattedAddress || `${details.locality}, ${details.city}`);
        if (onLocationResolved) {
          onLocationResolved(details);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          const msg = err.message || 'Unable to resolve address for this location.';
          setErrorMessage(msg);
          // Pass coordinate-only data on error without fabricated values
          if (onLocationResolved) {
            onLocationResolved({
              success: false,
              coordinates: { lat, lng },
              error: msg,
            });
          }
        }
      } finally {
        notifyResolving(false);
      }
    },
    [notifyResolving, onLocationResolved]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const initialLat = center?.lat || 22.7196;
    const initialLng = center?.lng || 75.8577;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
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

    const marker = L.marker([initialLat, initialLng], {
      icon: svgIcon,
      draggable: interactive,
    }).addTo(map);

    const radiusMeters = (Number(radiusKm) || 5.0) * 1000;
    const circle = L.circle([initialLat, initialLng], {
      radius: radiusMeters,
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

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (searchAbortRef.current) searchAbortRef.current.abort();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update center and circle radius when props change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;

    const lat = center?.lat || 22.7196;
    const lng = center?.lng || 75.8577;
    const radiusMeters = (Number(radiusKm) || 5.0) * 1000;

    markerRef.current.setLatLng([lat, lng]);
    circleRef.current.setLatLng([lat, lng]);
    circleRef.current.setRadius(radiusMeters);
  }, [center?.lat, center?.lng, radiusKm]);

  // Debounced search places handler
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      searchAbortRef.current = new AbortController();

      setIsSearching(true);
      try {
        const results = await searchPlaces(searchQuery, searchAbortRef.current.signal);
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
    const { lat, lng } = place.coordinates;
    setSearchQuery(place.name || place.formattedAddress);
    setSuggestions([]);

    if (mapRef.current && markerRef.current && circleRef.current) {
      mapRef.current.flyTo([lat, lng], 13, { duration: 0.8 });
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
    }

    resolveCoordinates(lat, lng);
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
                  className="w-full text-left px-3 py-2 hover:bg-surface-subtle transition flex items-start gap-2.5"
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
